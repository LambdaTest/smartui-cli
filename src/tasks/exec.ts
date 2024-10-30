import { ListrTask, ListrRendererFactory, createWritable } from 'listr2'
import { Context } from '../types.js'
import chalk from 'chalk'
import spawn from 'cross-spawn'
import { updateLogContext } from '../lib/logger.js'
import fs from 'fs';

let isPollingActive = false;

// Global SIGINT handler
process.on('SIGINT', () => {
    if (isPollingActive) {
        console.log('Fetching results interrupted. Exiting...');
        isPollingActive = false;
    } else {
        console.log('\nExiting gracefully...');
    }
    process.exit(0);
});

// Background polling function
async function startPolling(ctx: Context, task: any): Promise<void> {
    console.log('Fetching results in progress....');
    isPollingActive = true;

    const intervalId = setInterval(async () => {
        if (!isPollingActive) {
            clearInterval(intervalId);
            return;
        }
        
        try {
            const resp = await ctx.client.getScreenshotData(ctx.build.id, ctx.build.baseline, ctx.log);

            fs.writeFileSync(ctx.options.fetchResultsFileName, JSON.stringify(resp, null, 2));
            ctx.log.debug(`Updated results in ${ctx.options.fetchResultsFileName}`);

            if (resp.build.build_status_ind === 'completed' || resp.build.build_status_ind === 'error') {
                clearInterval(intervalId);
                console.log(`Fetching results completed. Final results written to ${ctx.options.fetchResultsFileName}`);
                isPollingActive = false;
            }
        } catch (error: any) {
            console.error(`Error fetching screenshot data: ${error.message}`);
            clearInterval(intervalId);
            isPollingActive = false;
        }
    }, 5000);
}

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Executing '${ctx.args.execCommand?.join(' ')}'`,
        task: async (ctx, task): Promise<void> => {

            if (ctx.options.fetchResults) {
                startPolling(ctx, task);
            }

            updateLogContext({task: 'exec'});

            return new Promise((resolve, reject) => {
                const childProcess = spawn(ctx.args.execCommand[0], ctx.args.execCommand?.slice(1));

                // Handle standard output
                let totalOutput = '';
                const output = createWritable((chunk: string) => {
                    totalOutput += chunk;
                    task.output = chalk.gray(totalOutput);
                })
                childProcess.stdout?.pipe(output);
                childProcess.stderr?.pipe(output);

                childProcess.on('error', (error) => {
                    task.output = chalk.gray(`error: ${error.message}`);
                    throw new Error(`Execution of '${ctx.args.execCommand?.join(' ')}' failed`);
                });

                childProcess.on('close', async (code, signal) => {
                    if (code !== null) {
                        task.title = `Execution of '${ctx.args.execCommand?.join(' ')}' completed; exited with code ${code}`;
                    } else if (signal !== null) {
                        throw new Error(`Child process killed with signal ${signal}`);
                    }

                    resolve();
                });
            });
        },
        rendererOptions: { persistentOutput: true },
        exitOnError: false
    }
}