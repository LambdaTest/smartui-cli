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
    .option('--parallel', 'Capture parallely on all browsers')
    .action(async function(file, _, command) {
        let ctx: Context = ctxInit(command.optsWithGlobals());

        if (!fs.existsSync(file)) {
            console.log(`Error: Web Static Config file ${file} not found.`);
            return;
        }
        try {
            ctx.webStaticConfig = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (!validateWebStaticConfig(ctx.webStaticConfig)) throw new Error(validateWebStaticConfig.errors[0].message);
        } catch (error: any) {
            console.log(`[smartui] Error: Invalid Web Static Config; ${error.message}`);
            return;
        }

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
