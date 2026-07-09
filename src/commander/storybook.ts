// @ts-nocheck
import { Command, Option } from 'commander'
// Faithful vendored relocation of the proven @lambdatest/smartui-storybook engine.
// The Storybook capture path talks to the same /storybook/* backend the standalone
// package already uses in production, so behavior is unchanged — it now simply lives
// inside the single unified `smartui` binary (no more colliding bins / double install).
import vendor from '../storybookVendor/index.cjs'
const { runStorybook } = vendor

const command = new Command();

command
    .name('storybook')
    .description('Snapshot Storybook stories (URL or static build directory)')
    .argument('<url-or-dir>', 'Storybook server URL or path to a storybook-static build directory')
    .option('-c, --config <file>', 'Config file path')
    .option('--force-rebuild', 'Force a rebuild of an already existing build', false)
    .option('--buildName <string>', 'Specify the build name for the pipeline')
    .addOption(new Option('--env <prod|stage>', 'Runtime environment').choices(['prod', 'stage']))
    .action(async function (target, options) {
        // Preserve the standalone package's option shape exactly.
        options.env = options.env || 'prod';
        await runStorybook(target, options);
    })

export default command;
