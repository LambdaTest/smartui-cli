import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import { captureScreenshots, captureScreenshotsConcurrent } from '../lib/screenshot.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js'
import { startPolling } from '../lib/utils.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: 'Capturing screenshots',
        task: async (ctx, task): Promise<void> => {
            try {
                ctx.task = task;
                if (ctx.options.fetchResults) {
                    startPolling(ctx);
                }
                updateLogContext({task: 'capture'});

                if (ctx.options.parallel) {
                    let { totalCapturedScreenshots, output } = await captureScreenshotsConcurrent(ctx);
                    if (totalCapturedScreenshots != ctx.webStaticConfig.length) {
                        throw new Error(output)
                    }
                } else {
                    let { capturedScreenshots, output } = await captureScreenshots(ctx);
                    if (capturedScreenshots != ctx.webStaticConfig.length) {
                        throw new Error(output)
                    }
                }
                task.title = 'Screenshots captured successfully'
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(`${error.message}`);
                throw new Error('Capturing screenshots failed');
            }
        },
        rendererOptions: { persistentOutput: true },
        exitOnError: false
    }
}