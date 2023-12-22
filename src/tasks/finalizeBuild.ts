import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Finalizing build`,
        task: async (ctx, task): Promise<void> => {
            try {
                await new Promise(resolve => (setTimeout(resolve, 2000)));
                await ctx.client.finalizeBuild(ctx.build.id, ctx.totalSnapshots, ctx.log);
                task.output = chalk.gray(`build url: ${ctx.build.url}`);
                task.title = 'Finalized build'
            } catch (error) {
                // log.debug(error)
                throw new Error('Finalize build error');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}