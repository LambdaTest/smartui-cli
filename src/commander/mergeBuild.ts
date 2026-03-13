import { Command } from 'commander';
import { Context } from '../types.js';
import { color, Listr, ListrDefaultRendererLogLevels } from 'listr2';
import auth from '../tasks/auth.js';
import ctxInit from '../lib/ctx.js';
import fetchBuildInfo from '../tasks/fetchBuildInfo.js'
import mergeBuilds from '../tasks/mergeBuilds.js'
import getGitInfo from '../tasks/getGitInfo.js'

const command = new Command();

command
    .name('build')
    .description('Merge a source build into the target build')
    .requiredOption('--source <string>', 'Source build to merge')
    .requiredOption('--target <string>', 'Target build to merge into')
    .action(async function(this: Command, options: { source: string, target: string }) {
        const { source, target } = options;
        let ctx: Context = ctxInit(command.optsWithGlobals());

        if (!source || source.trim() === '') {
            ctx.log.error('Error: The --source option cannot be empty.');
            process.exit(1);
        }
        if (!target || target.trim() === '') {
            ctx.log.error('Error: The --target option cannot be empty.');
            process.exit(1);
        }

        ctx.log.debug(`Merging source build '${source}' into target build '${target}'`);
        ctx.mergeBuildSource = source
        ctx.mergeBuildTarget = target
        ctx.mergeByBuild = true

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                getGitInfo(ctx),
                fetchBuildInfo(ctx),
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
            process.exitCode = 1;
        }
    });

export default command;
