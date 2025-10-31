import { Command } from 'commander';
import { Context } from '../types.js';
import { color, Listr, ListrDefaultRendererLogLevels } from 'listr2';
import startServer from '../tasks/startServer.js';
import authExec from '../tasks/authExec.js';
import ctxInit from '../lib/ctx.js';
import getGitInfo from '../tasks/getGitInfo.js';
import createBuildExec from '../tasks/createBuildExec.js';
import snapshotQueue from '../lib/snapshotQueue.js';
import { startPolling, startPingPolling } from '../lib/utils.js';
import startTunnel from '../tasks/startTunnel.js'

const command = new Command();

command
    .name('exec:start')
    .description('Start SmartUI server')
    .option('-P, --port <number>', 'Port number for the server')
    .option('--fetch-results [filename]', 'Fetch results and optionally specify an output file, e.g., <filename>.json')
    .option('--buildName <string>', 'Specify the build name')
    .action(async function(this: Command) {
        const options = command.optsWithGlobals();
        if (options.buildName === '') {
            console.log(`Error: The '--buildName' option cannot be an empty string.`);
            process.exit(1);
        }
        let ctx: Context = ctxInit(command.optsWithGlobals());
        ctx.snapshotQueue = new snapshotQueue(ctx);
        ctx.totalSnapshots = 0
        ctx.isStartExec = true
        ctx.sourceCommand = 'exec-start'
        
        let tasks = new Listr<Context>(
            [
                authExec(ctx),
                startServer(ctx),
                getGitInfo(ctx),
                ...(ctx.config.tunnel && ctx.config.tunnel?.type === 'auto' ? [startTunnel(ctx)] : []),
                createBuildExec(ctx),

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
        );

        try {
            await tasks.run(ctx);
            if (ctx.build && ctx.build.id && !ctx.autoTunnelStarted) {
                startPingPolling(ctx);
            }
            if (ctx.options.fetchResults && ctx.build && ctx.build.id) {
                startPolling(ctx, '', false, '')
            }

        } catch (error) {
            console.error('Error during server execution:', error);
            process.exit(1);
        }
    });

export default command;
