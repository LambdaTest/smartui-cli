import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Finalizing build`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'finalizeBuild'});

            try {
                await new Promise(resolve => (setTimeout(resolve, 2000)));
                await ctx.client.finalizeBuild(ctx.build.id, ctx.totalSnapshots, ctx.log);
                task.output = chalk.gray(`build url: ${ctx.build.url}`);
                task.title = 'Finalized build'
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Finalize build failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}