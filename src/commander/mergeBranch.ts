import { Command } from 'commander';
import { Context } from '../types.js';
import { color, Listr, ListrDefaultRendererLogLevels } from 'listr2';
import auth from '../tasks/auth.js';
import ctxInit from '../lib/ctx.js';
import fetchBranchInfo from '../tasks/fetchBranchInfo.js'
import mergeBuilds from '../tasks/mergeBuilds.js'
import getGitInfo from '../tasks/getGitInfo.js'
import constants from '../lib/constants.js';
import fs from 'fs';
import pkgJSON from '../../package.json'
import chalk from 'chalk'

const command = new Command();

command
    .name('branch')
    .description('Merge a source branch into the target branch')
    .requiredOption('--source <string>', 'Source branch to merge')
    .requiredOption('--target <string>', 'Target branch to merge into')
    .action(async function(this: Command, options: { source: string, target: string }) {
        const { source, target } = options;

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

        if (!source || source.trim() === '') {
            ctx.log.error('Error: The --source option cannot be empty.');
            process.exit(1);
        }
        if (!target || target.trim() === '') {
            ctx.log.error('Error: The --target option cannot be empty.');
            process.exit(1);
        }

        ctx.log.debug(`Merging source branch '${source}' into branch branch '${target}'`);
        ctx.mergeBranchSource = source
        ctx.mergeBranchTarget = target
        ctx.mergeByBranch = true

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                getGitInfo(ctx),
                fetchBranchInfo(ctx),
                mergeBuilds(ctx),
            ],
            {
                rendererOptions: {
                    icon: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: '→'
                    },
                    color: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: color.gray
                    }
                }
            }
        );

        try {
            await tasks.run(ctx);
        } catch (error) {
            console.error('Error during merge operation:', error);
        }
    });

export default command;
