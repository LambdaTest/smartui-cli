import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';
import startServer from '../lib/server.js'
import { updateLogContext } from '../lib/logger.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Setting up SmartUI server`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'startServer'});

            try {
                ctx.server = await startServer(ctx);
                task.output = chalk.gray(`listening on port ${ctx.server.addresses()[0]?.port}`);
                task.title = 'SmartUI started'
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('SmartUI server setup failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}