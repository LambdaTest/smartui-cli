import { Command } from 'commander'
import which from 'which'
import { Context } from '../types.js'
import { color, Listr, ListrDefaultRendererLogLevels } from 'listr2'
import startServer from '../tasks/startServer.js'
import auth from '../tasks/auth.js'
import ctxInit from '../lib/ctx.js'
import getGitInfo from '../tasks/getGitInfo.js';
import createBuild from '../tasks/createBuild.js'
import exec from '../tasks/exec.js'
import finalizeBuild from '../tasks/finalizeBuild.js'

const command = new Command();

command
    .name('exec')
    .description('Run test commands around SmartUI')
    .argument('<command...>', 'Command supplied for running tests')
    .option('-P, --port <number>', 'Port number for the server')
    .action(async function(execCommand, _, command) {
        let ctx: Context = ctxInit(command.optsWithGlobals());

        if (!which.sync(execCommand[0], { nothrow: true })) {
            ctx.log.error(`Error: Command not found "${execCommand[0]}"`);
            return
        }
        ctx.args.execCommand = execCommand
        ctx.totalSnapshots = 0

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                startServer(ctx),
                getGitInfo(ctx),
                createBuild(ctx),
                exec(ctx),
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
            ctx.log.info('\nRefer docs: https://www.lambdatest.com/support/docs/smart-visual-regression-testing/');
        } finally {
            await ctx.server?.close();
            await ctx.browser?.close();
        }
    })

export default command;
