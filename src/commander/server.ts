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
import fs from 'fs';
import constants from '../lib/constants.js';
import pkgJSON from '../../package.json'
import chalk from 'chalk'

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
        try {
            if (fs.existsSync(constants.LOG_FILE_PATH)) {
                fs.unlinkSync(constants.LOG_FILE_PATH);
            }
        } catch (err) {}
        try {
            if (fs.existsSync(constants.LOG_FILE_PATH_STOP)) {
                fs.unlinkSync(constants.LOG_FILE_PATH_STOP);
            }
        } catch (err) {}
        let ctx: Context = ctxInit(command.optsWithGlobals()); 
        try {
            let { data: { latestVersion, deprecated, additionalDescription } } = await ctx.client.checkUpdate(ctx.log);
            console.log(`\nLambdaTest SmartUI CLI v${pkgJSON.version}`);
            console.log(chalk.yellow(`${additionalDescription}`));
            if (deprecated){ 
                console.warn(`This version is deprecated. A new version ${latestVersion} is available!`);
            }
            else if (pkgJSON.version !== latestVersion){ 
                console.log(chalk.green(`A new version ${latestVersion} is available!`));
            }
            else console.log(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
        } catch (error) {
            // console.error(error);
            console.log(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
        }
        ctx.snapshotQueue = new snapshotQueue(ctx);
        ctx.totalSnapshots = 0
        ctx.isStartExec = true

        let tasks = new Listr<Context>(
            [
                authExec(ctx),
                startServer(ctx),
                getGitInfo(ctx),
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
            if (ctx.build && ctx.build.id) {
                startPingPolling(ctx);
            }
            if (ctx.options.fetchResults && ctx.build && ctx.build.id) {
                startPolling(ctx, '', false, '')
            }
    
        } catch (error) {
            console.error('Error during server execution:', error);
        }
    });

export default command;
