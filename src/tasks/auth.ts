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
                if ( !ctx.env.PROJECT_NAME  && !ctx.env.PROJECT_TOKEN ) {
                    ctx.authenticatedInitially = false
                    task.output = chalk.gray(`Empty PROJECT_TOKEN and PROJECT_NAME. Skipping authentication. Expecting SmartUI Capabilities in driver!`)
                    task.title = 'Skipped Authentication with SmartUI';
                } else {
                    const authResult = await ctx.client.auth(ctx.log, ctx.env);
                    if (authResult === 2) {
                        task.output = chalk.gray(`New project '${ctx.env.PROJECT_NAME}' created successfully`);
                    } else if (authResult === 0) {
                        task.output = chalk.gray(`Using existing project token '******#${ctx.env.PROJECT_TOKEN.split('#').pop()}'`);
                    } else if (authResult === 1) {
                        task.output = chalk.gray(`Using existing project '${ctx.env.PROJECT_NAME}'`);
                    }
                    ctx.authenticatedInitially = true
                    task.title = 'Authenticated with SmartUI';
                }
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Authentication failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}