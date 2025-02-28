import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js';
import { uploadScreenshots } from '../lib/screenshot.js';
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js';
import { startPolling } from '../lib/utils.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory> => {
    return {
        title: 'Uploading screenshots',
        task: async (ctx, task): Promise<void> => {
            try {
                ctx.task = task;
                if (ctx.options.fetchResults) {
                    startPolling(ctx);
                }
                updateLogContext({ task: 'upload' });

                await uploadScreenshots(ctx);

                task.title = 'Screenshots uploaded successfully';
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(`${error.message}`);
                throw new Error('Uploading screenshots failed');
            }
        },
        rendererOptions: { persistentOutput: true },
        exitOnError: false
    };
};
