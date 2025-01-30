import { ListrTask, ListrRendererFactory, createWritable } from 'listr2'
import { Context } from '../types.js'
import chalk from 'chalk'
import spawn from 'cross-spawn'
import { updateLogContext } from '../lib/logger.js'
import { startPolling } from '../lib/utils.js'

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Executing '${ctx.args.execCommand?.join(' ')}'`,
        task: async (ctx, task): Promise<void> => {

            if (ctx.options.fetchResults) {
                startPolling(ctx);
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