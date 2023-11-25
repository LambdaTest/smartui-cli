import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import { captureScreenshots } from '../lib/screenshot.js'
import chalk from 'chalk';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: 'Capturing screenshots',
        task: async (ctx, task): Promise<void> => {
            try {
                let { staticConfig: screenshots } = ctx;

                let totalScreenshots = await captureScreenshots(ctx, screenshots);
                task.title = 'Screenshots captured successfully'
                task.output = chalk.gray(`total screenshots: ${totalScreenshots}`)
            } catch (error) {
                // log.debug(error)
                console.error(error);
                throw new Error('Capturing screenshots failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}