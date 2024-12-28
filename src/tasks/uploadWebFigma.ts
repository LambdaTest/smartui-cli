import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import { captureScreenshots } from '../lib/screenshot.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js'
import uploadWebFigma from '../lib/uploadWebFigma.js';


export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory> => {
    return {
        title: 'Uploading Web Figma',
        task: async (ctx, task): Promise<void> => {
            try {
                ctx.task = task;
                updateLogContext({task: 'upload-figma-web'});

                let results = await uploadWebFigma(ctx);
                if (results != 'success') {
                    throw new Error('Uploading Web Figma Screenshot failed');
                }
                task.title = 'Web Figma images uploaded successfully to SmartUI';
                ctx.log.debug(`Web Figma processed: ${results}`);
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(`${error.message}`);
                throw new Error('Uploading Web Figma Screenshots failed');
            }
        },
        rendererOptions: { persistentOutput: true },
        exitOnError: false
    }
}