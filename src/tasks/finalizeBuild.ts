import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';

export default (ctx: Context, waitTime: number): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Finalizing build`,
        task: async (ctx, task): Promise<void> => {
            try {
                if (waitTime > 0) {
                    await new Promise(resolve => (setTimeout(resolve, waitTime)));
                    await ctx.client.finalizeBuild(ctx.build.id, ctx.log);
                }
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