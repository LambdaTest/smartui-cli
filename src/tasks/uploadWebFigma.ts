import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js'
import uploadWebFigma from '../lib/uploadWebFigma.js';
import fetchFigmaResults from '../lib/fetchFigma.js';
import { startPolling } from '../lib/utils.js';


export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory> => {
    return {
        title: 'Processing Web Figma',
        task: async (ctx, task): Promise<void> => {
            try {
                ctx.task = task;
                updateLogContext({task: 'upload-figma-web'});

                let results = await uploadWebFigma(ctx);
                if (results != 'success') {
                    throw new Error('Uploading Web Figma Screenshot failed');
                }

                //fetching the figma results
                if (ctx.build.id) {
                    task.output = chalk.gray(`Build Id: ${ctx.build.id}`);
                    let figmaOutput = await fetchFigmaResults(ctx);
                    const jsonObject = JSON.parse(figmaOutput);
                    let output = JSON.stringify(jsonObject, null, 2);
                    task.output = task.output + "\n" + chalk.green(`${output}`); 
                }
                if (ctx.options.fetchResults) {
                    startPolling(ctx, '', false, '')
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
        exitOnError: true
    }
}