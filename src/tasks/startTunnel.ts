import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js';
import { startTunnelBinary } from '../lib/utils.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Starting Tunnel`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'startTunnel'});

            try {
                await startTunnelBinary(ctx);
                ctx.isStartExec = true;
                ctx.autoTunnelStarted = true;
                task.title = 'Tunnel Started';
                task.output = chalk.gray('Tunnel started successfully');
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Error while starting tunnel binary');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}