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
                let resp = await ctx.client.createBuild(ctx.git, ctx.config, ctx.log, ctx.build.name, ctx.isStartExec, ctx.env.SMART_GIT, ctx.options.markBaseline, ctx.options.baselineBuild, ctx.options.scheduled,ctx.env.LT_USERNAME,ctx.env.LT_ACCESS_KEY);
                if (resp && resp.data && resp.data.buildId) {
                    ctx.build = {
                        id: resp.data.buildId,
                        name: resp.data.buildName,
                        url: resp.data.buildURL,
                        baseline: resp.data.baseline,
                        useKafkaFlow: resp.data.useKafkaFlow || false,
                        checkPendingRequests: resp.data.checkPendingRequests || false,
                    }
                    process.env.SMARTUI_BUILD_ID = resp.data.buildId;
                    process.env.SMARTUI_BUILD_NAME = resp.data.buildName;
                    for (const warning of resp.warnings || []) ctx.log.warn(warning);
                } else if (resp && resp.error) {
                    if (resp.error.message) {
                        ctx.log.error(`Error while creation of build: ${resp.error.message}`)
                        throw new Error(`Error while creation of build: ${resp.error.message}`);
                    }
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