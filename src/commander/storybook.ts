import { Command, Option } from 'commander'
import fs from 'fs'
// Faithful vendored relocation of the proven @lambdatest/smartui-storybook engine.
// The Storybook capture path talks to the same /storybook/* backend the standalone
// package already uses in production, so behavior is unchanged. It now simply lives
// inside the single unified `smartui` binary (no more colliding bins / double install).
import vendor, { type StorybookRunOptions } from '../storybookVendor/index.cjs'
import tui from '../lib/tui.cjs'
const { runStorybook, redactSecrets } = vendor

type Mode = 'url' | 'dir';

interface RunPreview {
    browsers: string;
    viewports: string;
    stories?: string;
}

/** Shape of a `storybook` block as far as the preview cares. Everything is optional
 *  because this runs before the engine validates the config. */
interface StorybookConfigBlock {
    browsers?: unknown;
    resolutions?: unknown;
    viewports?: unknown;
}

/** A Storybook story index entry, in either the legacy or the >= 8 payload shape. */
interface StoryIndexEntry {
    type?: string;
}

// Best-effort preview of what this run will cover (never throws).
function preview(target: string, mode: Mode, configPath?: string): RunPreview {
    let browsers = 'chrome, firefox, safari, edge';
    let viewports = '1920×1080';
    let stories: string | undefined;
    try {
        if (configPath && fs.existsSync(configPath)) {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { storybook?: StorybookConfigBlock };
            const sb: StorybookConfigBlock = parsed.storybook ?? {};
            if (Array.isArray(sb.browsers) && sb.browsers.length) browsers = sb.browsers.join(', ');
            const vp = sb.resolutions ?? sb.viewports;
            if (Array.isArray(vp) && vp.length) {
                viewports = vp.map((v: unknown) => (Array.isArray(v) ? v.join('×') : String(v))).join('  ');
            }
        }
    } catch (_) { /* preview only: a malformed config is the engine's error to report */ }
    try {
        if (mode === 'dir') {
            const idx = fs.existsSync(`${target}/stories.json`) ? `${target}/stories.json`
                      : fs.existsSync(`${target}/index.json`) ? `${target}/index.json` : null;
            if (idx) {
                const j = JSON.parse(fs.readFileSync(idx, 'utf8')) as {
                    stories?: Record<string, StoryIndexEntry>;
                    entries?: Record<string, StoryIndexEntry>;
                };
                const entries = j.stories ?? j.entries ?? {};
                const n = Object.values(entries).filter((e) => e.type !== 'docs').length;
                stories = `${n} stories`;
            }
        }
    } catch (_) { /* preview only: the engine reports a bad or missing index itself */ }
    return { browsers, viewports, stories };
}

/** Options commander hands the action, before global flags are merged in. */
interface StorybookCommandOptions extends StorybookRunOptions {
    config?: string;
    forceRebuild?: boolean;
    buildName?: string;
    env?: 'prod' | 'stage';
}

const command = new Command();

command
    .name('storybook')
    .description('Snapshot Storybook stories (URL or static build directory)')
    .argument('<url-or-dir>', 'Storybook server URL or path to a storybook-static build directory')
    .option('-c, --config <file>', 'Config file path')
    .option('--force-rebuild', 'Force a rebuild of an already existing build', false)
    .option('--buildName <string>', 'Specify the build name for the pipeline')
    .addOption(new Option('--env <prod|stage>', 'Runtime environment').choices(['prod', 'stage']))
    .action(async function (target: string, options: StorybookCommandOptions, command: Command) {
        // Merge root-level global flags (e.g. --config, --markBaseline) so they reach
        // the engine even when the same flag exists globally and locally.
        const globals = command.optsWithGlobals();
        options.config = options.config || globals['config'];
        options.env = options.env || 'prod';
        const mode: Mode = /^https?:\/\//.test(target) ? 'url' : 'dir';
        const p = preview(target, mode, options.config);

        tui.banner();
        tui.runHeader({
            target,
            mode,
            buildName: options.buildName,
            env: options.env,
            configPath: options.config,
            browsers: p.browsers,
            viewports: p.viewports,
            storyHint: p.stories,
        });

        // Tee stdout so we can parse the final build stats for a summary box.
        // The engine's polling isn't fully awaited, so we print the summary on
        // 'beforeExit'. That fires only once the event loop drains, i.e. after
        // polling truly finishes, guaranteeing the box is the last thing shown.
        //
        // Only a bounded tail is kept. The engine prints the serialised DOM and CSS of every
        // story, which is roughly 360 KB of stdout for 17 stories, so buffering all of it to
        // pull out five numbers would hold tens of megabytes on a large Storybook. Every stat
        // below appears in the build-details block at the very end, well inside the tail.
        // Failure lines can appear at any point, so those are latched as they stream past
        // rather than searched for afterwards.
        const TAIL_LIMIT = 64 * 1024;
        const origLog = console.log;
        let captured = '';
        let sawFailure = false;
        let sawBaseline = false;
        console.log = (...a: unknown[]) => {
            // Scrub on the way out. The engine prints server-supplied messages, and at least one
            // backend error echoes the caller's access key, which would otherwise land in stdout
            // and in CI logs.
            a = a.map((x) => (typeof x === 'string' ? redactSecrets(x) : x));
            const line = a.map(String).join(' ') + '\n';
            if (/Build failed|\[smartui\] Error:/i.test(line)) sawFailure = true;
            if (/baseline build/i.test(line)) sawBaseline = true;
            captured += line;
            if (captured.length > TAIL_LIMIT) captured = captured.slice(-TAIL_LIMIT);
            origLog(...a);
        };

        const grab = (re: RegExp): string | undefined => captured.match(re)?.[1];

        // Pull a usable failure line out of the tail. The engine is inconsistent about this:
        // some paths log "Build failed: Error: <message>", others log a descriptive line with
        // an empty message after "Error:" (an unreachable Storybook prints
        // "Connection to storybook not established. Error: " and nothing more). Taking only the
        // text after "Error:" therefore produced an empty box. Walk back through the engine's
        // own lines instead and use the last one that says something.
        const failureMessage = (): string | undefined => {
            const lines = captured.split('\n').reverse();
            for (const raw of lines) {
                const line = raw.replace(/^\[smartui\]\s*/, '').trim();
                if (!line) continue;
                if (!/error|failed|not established|cannot|invalid|no stories/i.test(line)) continue;
                // Drop a dangling "Error:" with nothing after it, then keep whatever is left.
                const cleaned = line.replace(/\s*Error:\s*$/i, '').replace(/\s+/g, ' ').trim();
                if (cleaned) return cleaned;
            }
            return undefined;
        };
        // Exit code 3 is the engine's "a build already exists for this commit" signal. It is a
        // deliberate skip, not a failure, and it must not be painted red.
        const BUILD_ALREADY_EXISTS = 3;

        let printed = false;
        const printSummary = () => {
            if (printed) return; printed = true;
            console.log = origLog;
            const code = typeof process.exitCode === 'number' ? process.exitCode : 0;
            if (code === BUILD_ALREADY_EXISTS) {
                tui.box(tui.paint('Storybook build skipped'), [
                    'A build already exists for this commit on this branch.',
                    tui.dim('Pass --force-rebuild to push a new one.'),
                ], { tag: ' skipped ', color: 'yellow' });
                return;
            }
            const failed = sawFailure || code !== 0;
            if (failed) { tui.resultBox(false, { message: failureMessage() }); return; }
            const url = grab(/Build URL:\s*(\S+)/i);
            const screenshots = grab(/Total Screenshots:\s*(\d+)/i);
            const stats = tui.kv([
                ['Screenshots', screenshots],
                ['Approved', grab(/Approved:\s*(\d+)/i)],
                ['Changes found', grab(/Changes found:\s*(\d+)/i)],
                ['Rejected', grab(/Rejected:\s*(\d+)/i)],
                ['Baseline', sawBaseline ? 'yes (first run, no comparisons)' : undefined],
            ]);
            // kv() drops empty values, so guard the lookup rather than assuming a row exists.
            const dashboardRow = url ? tui.kv([['Dashboard', url]])[0] : undefined;
            if (dashboardRow) stats.unshift(dashboardRow);

            // A build that captured nothing still reports success and exits 0, so in CI it is
            // indistinguishable from a passing visual test run. The exit code is a contract we
            // are not changing here, but the run should at least say so out loud.
            const capturedNothing = screenshots === '0';
            if (capturedNothing) {
                stats.push(tui.dim('No screenshots were captured. Nothing was compared.'));
            }
            tui.box(
                `${tui.paint(capturedNothing ? 'Storybook build complete, but empty' : 'Storybook build complete')}`,
                stats.length ? stats : [tui.dim('See log above.')],
                { tag: capturedNothing ? ' warning ' : ' done ', color: capturedNothing ? 'yellow' : 'green' },
            );
        };
        // beforeExit covers the normal path, where the engine's polling is still draining the
        // event loop. It does NOT fire when the engine calls process.exit() directly, which it
        // does for "No stories found", an unreachable Storybook and similar. Hooking 'exit' as
        // well means every run ends with a summary instead of trailing off after the launch box.
        // Writes from an 'exit' handler are synchronous and survive both pipes and files.
        process.once('beforeExit', printSummary);
        process.once('exit', printSummary);

        try {
            await runStorybook(target, options);
        } catch (error: unknown) {
            console.log = origLog;
            printed = true;
            tui.resultBox(false, { message: error instanceof Error ? error.message : String(error) });
            process.exitCode = 1;
        }
    })

export default command;
