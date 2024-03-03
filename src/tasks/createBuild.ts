import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Creating SmartUI build`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'createBuild'});

            try {
                let resp = await ctx.client.createBuild(ctx.git, ctx.webConfig, ctx.log);
                ctx.build = {
                    id: resp.data.buildId,
                    name: resp.data.buildName,
                    url: resp.buildURL,
                    baseline: resp.data.baseline || false,
                    projectId: resp.data.projectId
                }
                task.output = chalk.gray(`build id: ${resp.data.buildId}`);
                task.title = 'SmartUI build created'
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(JSON.parse(error.message).message);
                throw new Error('SmartUI build creation failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}