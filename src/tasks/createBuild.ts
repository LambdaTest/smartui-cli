import {ListrRendererFactory, ListrTask} from 'listr2';
import {Context} from '../types.js'
import chalk from 'chalk';
import {updateLogContext} from '../lib/logger.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Creating SmartUI build`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'createBuild'});

            try {
                let resp = await ctx.client.createBuild(ctx.git, ctx.config, ctx.log);
                ctx.build = {
                    id: resp.data.buildId,
                    name: resp.data.buildName,
                    url: resp.data.buildURL,
                    baseline: resp.data.baseline,
                    useKafkaFlow: resp.data.useKafkaFlow || false,
                }

                task.output = chalk.gray(`build id: ${resp.data.buildId}`);
                task.title = 'SmartUI build created'
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('SmartUI build creation failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}