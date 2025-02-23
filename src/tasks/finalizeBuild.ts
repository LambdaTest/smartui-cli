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
                await ctx.client.finalizeBuild(ctx.build.id, ctx.totalSnapshots, ctx.log);
                task.output = chalk.gray(`build url: ${ctx.build.url}`);
                task.title = 'Finalized build';
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Finalize build failed');
            }

            // cleanup and upload logs
            try {
                await ctx.browser?.close();
                ctx.log.debug(`Closed browser`);
                await ctx.server?.close();
                ctx.log.debug(`Closed server`);
                let resp = await ctx.client.getS3PreSignedURL(ctx);
                if (ctx.isSnapshotCaptured) {
                    ctx.log.debug(`Log file to be uploaded`)
                    await ctx.client.uploadLogs(ctx, resp.data.url);
                }
                fs.unlinkSync(constants.LOG_FILE_PATH);
                ctx.log.debug(`Log file deleted: ${constants.LOG_FILE_PATH}`);
            } catch (error: any) {
                ctx.log.debug(error);
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}