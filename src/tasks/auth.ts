import { ListrTask, ListrRendererFactory } from 'listr2'
import { Context } from '../types.js'
import chalk from 'chalk'
import { updateLogContext } from '../lib/logger.js'

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Authenticating with SmartUI`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'auth'});

            try {
                await ctx.client.auth(ctx.log);
                task.output = chalk.gray(`using project token '******#${ctx.env.PROJECT_TOKEN.split('#').pop()}'`);
                task.title = 'Authenticated with SmartUI';
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Authentication failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}