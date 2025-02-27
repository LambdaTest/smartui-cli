import fs from 'fs'
import { Command } from 'commander'
import { Context } from '../types.js'
import { color, Listr, ListrDefaultRendererLogLevels, LoggerFormat } from 'listr2'
import auth from '../tasks/auth.js'
import ctxInit from '../lib/ctx.js'
import getGitInfo from '../tasks/getGitInfo.js'
import finalizeBuild from '../tasks/finalizeBuild.js'
import { validateFigmaDesignConfig, validateWebFigmaConfig } from '../lib/schemaValidation.js'
import uploadFigmaDesigns from '../tasks/uploadFigmaDesigns.js'
import uploadWebFigma from '../tasks/uploadWebFigma.js'
import { verifyFigmaWebConfig } from '../lib/config.js'
import chalk from 'chalk';


const uploadFigma = new Command();
const uploadWebFigmaCommand = new Command();

uploadFigma
    .name('upload-figma')
    .description('Capture screenshots of static sites')
    .argument('<file>', 'figma design config file')
    .option('--markBaseline', 'Mark the uploaded images as baseline')
    .option('--buildName <buildName>', 'Name of the build')
    .action(async function (file, _, command) {
        let ctx: Context = ctxInit(command.optsWithGlobals());
        ctx.isSnapshotCaptured = true;

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

uploadWebFigmaCommand
    .name('upload-figma-web')
    .description('Capture screenshots of static sites')
    .argument('<file>', 'figma config config file')
    .option('--markBaseline', 'Mark the uploaded images as baseline')
    .option('--buildName <buildName>', 'Name of the build')
    .option('--fetch-results [filename]', 'Fetch results and optionally specify an output file, e.g., <filename>.json')
    .action(async function (file, _, command) {
        let ctx: Context = ctxInit(command.optsWithGlobals());

        if (!fs.existsSync(file)) {
            console.log(`Error: figma-web config file ${file} not found.`);
            return;
        }
        try {
            ctx.config = JSON.parse(fs.readFileSync(file, 'utf8'));
            ctx.log.info(JSON.stringify(ctx.config));
            if (!validateWebFigmaConfig(ctx.config)) {
                ctx.log.debug(JSON.stringify(validateWebFigmaConfig.errors, null, 2));
                // Iterate and add warning for "additionalProperties"
                validateWebFigmaConfig.errors?.forEach(error => {
                    if (error.keyword === "additionalProperties") {
                        ctx.log.warn(`Additional property "${error.params.additionalProperty}" is not allowed.`)
                    } else {
                        const validationError = error.message;
                        throw new Error(validationError || 'Invalid figma-web config found in file : ' + file);
                    }
                });
            }

            //Validate the figma config
            verifyFigmaWebConfig(ctx);
        } catch (error: any) {
            ctx.log.error(chalk.red(`Invalid figma-web config; ${error.message}`));
            return;
        }

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                getGitInfo(ctx),
                uploadWebFigma(ctx),
                finalizeBuild(ctx)
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

export { uploadFigma, uploadWebFigmaCommand }
