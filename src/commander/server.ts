import { Command } from 'commander';
import { Context } from '../types.js';
import { color, Listr, ListrDefaultRendererLogLevels } from 'listr2';
import startServer from '../tasks/startServer.js';
import auth from '../tasks/auth.js';
import ctxInit from '../lib/ctx.js';
import getGitInfo from '../tasks/getGitInfo.js';
import createBuild from '../tasks/createBuild.js';
import snapshotQueue from '../lib/snapshotQueue.js';
import { startPolling } from '../lib/utils.js';

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

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                startServer(ctx),
                getGitInfo(ctx),
                createBuild(ctx),

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
            if (ctx.options.fetchResults) {
                startPolling(ctx);
            }
            
    
        } catch (error) {
            console.error('Error during server execution:', error);
        }
    });

export default command;
