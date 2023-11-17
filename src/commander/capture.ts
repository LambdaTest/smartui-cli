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

const command = new Command();

command
    .name('capture')
    .description('Capture screenshots of static sites')
    .argument('<file>', 'Web static config file')
    .action(async function(file, _, command) {
        let ctx: Context = ctxInit(command.optsWithGlobals());

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                getGitInfo(ctx),
                createBuild(ctx),
                captureScreenshots(ctx),
                finalizeBuild(ctx, 0)
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
            if (!fs.existsSync(file)) {
                console.log(`Error: Config file ${file} not found.`);
                return;
            }
            ctx.staticConfig = JSON.parse(fs.readFileSync(file, 'utf8'));

            await tasks.run(ctx);
        } catch (error) {
            console.log('\nRefer docs: https://www.lambdatest.com/support/docs/smart-visual-regression-testing/');
        }

    })

export default command;
