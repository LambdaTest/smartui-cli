import { Command, Option } from 'commander'
import fs from 'fs'
// Faithful vendored relocation of the proven @lambdatest/smartui-storybook engine.
// The Storybook capture path talks to the same /storybook/* backend the standalone
// package already uses in production, so behavior is unchanged. It now simply lives
// inside the single unified `smartui` binary (no more colliding bins / double install).
import vendor, { type StorybookRunOptions } from '../storybookVendor/index.cjs'
import tui from '../lib/tui.cjs'
const { runStorybook } = vendor

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
        const origLog = console.log;
        let captured = '';
        console.log = (...a: unknown[]) => { captured += a.map(String).join(' ') + '\n'; origLog(...a); };

        const grab = (re: RegExp): string | undefined => captured.match(re)?.[1];
        let printed = false;
        const printSummary = () => {
            if (printed) return; printed = true;
            console.log = origLog;
            const failed = /Build failed|\[smartui\] Error:/i.test(captured) || process.exitCode === 1;
            if (failed) { tui.resultBox(false, { message: grab(/(?:Build failed|Error):\s*(.+)/i) }); return; }
            const url = grab(/Build URL:\s*(\S+)/i);
            const stats = tui.kv([
                ['Screenshots', grab(/Total Screenshots:\s*(\d+)/i)],
                ['Approved', grab(/Approved:\s*(\d+)/i)],
                ['Changes found', grab(/Changes found:\s*(\d+)/i)],
                ['Rejected', grab(/Rejected:\s*(\d+)/i)],
                ['Baseline', /baseline build/i.test(captured) ? 'yes (first run, no comparisons)' : undefined],
            ]);
            // kv() drops empty values, so guard the lookup rather than assuming a row exists.
            const dashboardRow = url ? tui.kv([['Dashboard', url]])[0] : undefined;
            if (dashboardRow) stats.unshift(dashboardRow);
            tui.box(`${tui.paint('Storybook build complete')}`, stats.length ? stats : [tui.dim('See log above.')], { tag: ' done ', color: 'green' });
        };
        process.once('beforeExit', printSummary);

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
