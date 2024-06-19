import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Processing snapshots`,
        task: async (ctx, task): Promise<void> => {

            try {
                // wait for snapshot queue to be empty
                await new Promise((resolve) => {
                    let output: string = '';
                    const intervalId = setInterval(() => {
                        if (ctx.snapshotQueue?.isEmpty() && !ctx.snapshotQueue?.isProcessing()) {
                            clearInterval(intervalId);
                            resolve();
                        } else {
                            task.title = `Processing snapshot ${ctx.snapshotQueue?.getProcessingSnapshot()}`
                        }
                    }, 500);
                })

                let output = '';
                for (let snapshot of ctx.snapshotQueue?.getProcessedSnapshots()) {
                    if (snapshot.error) output += `${chalk.red('\u{2717}')} ${chalk.gray(`${snapshot.name}\n[error] ${snapshot.error}`)}\n`;
                    else output += `${chalk.green('\u{2713}')} ${chalk.gray(snapshot.name)}\n${snapshot.warnings.length ?  chalk.gray(`[warning] ${snapshot.warnings.join('\n[warning] ')}\n`) : ''}`;
                }
                task.output = output;
                task.title = 'Processed snapshots'
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Processing of snapshots failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}
