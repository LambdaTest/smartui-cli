import fs from 'fs'
import { Command } from 'commander'
import { Context } from '../types.js'
import { color , Listr, ListrDefaultRendererLogLevels, LoggerFormat } from 'listr2'
import auth from '../tasks/auth.js'
import ctxInit from '../lib/ctx.js'
import getGitInfo from '../tasks/getGitInfo.js'
import createBuild from '../tasks/createBuild.js'
import captureScreenshots from '../tasks/captureScreenshots.js'
import finalizeBuild from '../tasks/finalizeBuild.js'
import { validateFigmaDesignConfig } from '../lib/schemaValidation.js'
import uploadFigmaDesigns from '../tasks/uploadFigmaDesigns.js'

const command = new Command();

command
    .name('upload-figma')
    .description('Capture screenshots of static sites')
    .argument('<file>', 'figma design config file')
    .option('--markBaseline', 'Mark the uploaded images as baseline')
    .option('--buildName <buildName>' , 'Name of the build')
    .option('--fetch-results [filename]', 'Fetch results and optionally specify an output file, e.g., <filename>.json')
    .action(async function(file, _, command) {
        let ctx: Context = ctxInit(command.optsWithGlobals());

        const { fetchResults } = command.opts();
        if (fetchResults) {
            ctx.options.fetchResults = true
            ctx.options.fetchResultsFileName = fetchResults === true ? 'results.json' : fetchResults;
        } else {
            ctx.options.fetchResults = false
        }

        if (!fs.existsSync(file)) {
            console.log(`Error: Figma Config file ${file} not found.`);
            return;
        }
        try {
            ctx.figmaDesignConfig = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (!validateFigmaDesignConfig(ctx.figmaDesignConfig)) {
                const validationError = validateFigmaDesignConfig.errors?.[0]?.message;
                throw new Error(validationError || 'Invalid figma design Config');
            }
        } catch (error: any) {
            console.log(`[smartui] Error: Invalid figma design Config; ${error.message}`);
            return;
        }

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                uploadFigmaDesigns(ctx)
            ],
            {
                rendererOptions: {
                    icon: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: `→`
                    },
                    color: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: color.gray as LoggerFormat
                    }
                }
            }
        )

        try {
            await tasks.run(ctx);
        } catch (error) {
            console.log('\nRefer docs: https://www.lambdatest.com/support/docs/smart-visual-regression-testing/');
        }

    })

export default command;
