import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import { updateLogContext } from '../lib/logger.js';
import chalk from 'chalk';
import { unlinkSync } from 'fs';
import constants from '../lib/constants.js';
import fs from 'fs';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Finalizing build`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'finalizeBuild'});

            try {
                if (ctx.build.id) {
                    await ctx.client.finalizeBuild(ctx.build.id, ctx.totalSnapshots, ctx.log);
                }
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Finalize build failed');
            }

            for (const [buildId, totalSnapshots] of ctx.buildToSnapshotCountMap.entries()) {
            
                try {
                    // Fetch projectToken from buildToProjectTokenMap
                    const projectToken = ctx.buildToProjectTokenMap?.get(buildId) || '';
                    await ctx.client.finalizeBuildForCapsWithToken(buildId, totalSnapshots, projectToken, ctx.log);
                } catch (error: any) {
                    ctx.log.debug(`Error finalizing build ${buildId}: ${error.message}`);
                }
            }
            

            task.output = chalk.gray(`build url: ${ctx.build.url}`);
            task.title = 'Finalized build';
            
            // cleanup and upload logs
            try {
                await ctx.browser?.close();
                ctx.log.debug(`Closed browser`);
                await ctx.server?.close();
                ctx.log.debug(`Closed server`);
                if (ctx.isSnapshotCaptured) {
                    ctx.log.debug(`Log file to be uploaded`)
                    let resp = await ctx.client.getS3PreSignedURL(ctx);
                    await ctx.client.uploadLogs(ctx, resp.data.url);
                }
            } catch (error: any) {
                ctx.log.debug(error);
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}