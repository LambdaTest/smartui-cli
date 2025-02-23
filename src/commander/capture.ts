import fs from 'fs'
import { Command } from 'commander'
import { Context } from '../types.js'
import { color, Listr, ListrDefaultRendererLogLevels } from 'listr2'
import auth from '../tasks/auth.js'
import ctxInit from '../lib/ctx.js'
import getGitInfo from '../tasks/getGitInfo.js'
import createBuild from '../tasks/createBuild.js'
import captureScreenshots from '../tasks/captureScreenshots.js'
import finalizeBuild from '../tasks/finalizeBuild.js'
import { validateWebStaticConfig } from '../lib/schemaValidation.js'

const command = new Command();

command
    .name('capture')
    .description('Capture screenshots of static sites')
    .argument('<file>', 'Web static config file')
    .option('-C, --parallel [number]', 'Specify the number of instances per browser', parseInt)
    .option('-F, --force', 'forcefully apply the specified parallel instances per browser')
    .option('--fetch-results [filename]', 'Fetch results and optionally specify an output file, e.g., <filename>.json')
    .option('--buildName <string>', 'Specify the build name')
    .action(async function(file, _, command) {
        const options = command.optsWithGlobals();
        if (options.buildName === '') {
            console.log(`Error: The '--buildName' option cannot be an empty string.`);
            process.exit(1);
        }
        let ctx: Context = ctxInit(command.optsWithGlobals());
        ctx.isSnapshotCaptured = true
        
        if (!fs.existsSync(file)) {
            ctx.log.error(`Web Static Config file ${file} not found.`);
            return;
        }
        try {
            ctx.webStaticConfig = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (!validateWebStaticConfig(ctx.webStaticConfig)){

                ctx.log.debug(JSON.stringify(validateWebStaticConfig.errors, null, 2));
                // Iterate and add warning for "additionalProperties"
                validateWebStaticConfig.errors?.forEach(error => {
                    if (error.keyword === "additionalProperties") {
                        ctx.log.warn(`Additional property "${error.params.additionalProperty}" is not allowed.`)
                    } else {
                        const validationError = error.message;
                        throw new Error(validationError || 'Invalid Web Static config found in file : ' + file);
                    }
                });
                throw new Error(validateWebStaticConfig.errors[0]?.message);
            } 

            if(ctx.webStaticConfig && ctx.webStaticConfig.length === 0) {
                ctx.log.error(`No URLs found in the specified config file -> ${file}`);
                return;
            }
        } catch (error: any) {
            ctx.log.error(`Invalid Web Static Config; ${error.message}`);
            return;
        }
        //Print Config here in debug mode
        ctx.log.debug(ctx.config);

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                getGitInfo(ctx),
                createBuild(ctx),
                captureScreenshots(ctx),
                finalizeBuild(ctx)
            ],
            {
                rendererOptions: {
                    icon: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: `→`
                    },
                    color: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: color.gray
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
