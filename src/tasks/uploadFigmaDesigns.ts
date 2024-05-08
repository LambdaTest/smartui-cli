import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import { captureScreenshots } from '../lib/screenshot.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js'
import uploadFigmaDesigns from '../lib/uploadFigmaDesigns.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory> => {
    return {
        title: 'Uploading Figma Designs',
        task: async (ctx, task): Promise<void> => {
            try {
                ctx.task = task;
                updateLogContext({task: 'upload-figma'});

                let results = await uploadFigmaDesigns(ctx);
                if (results.status != 'success') {
                    throw new Error('Uploading Figma designs failed 1');
                  }
                task.title = 'Figma designs images uploaded successfully to SmartUI';
                ctx.log.debug(`Figma designs processed: ${results}`);
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(`${error.message}`);
                throw new Error('Uploading Figma designs failed');
            }
        },
        rendererOptions: { persistentOutput: true },
        exitOnError: false
    }
}