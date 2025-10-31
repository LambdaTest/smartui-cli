import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import { updateLogContext } from '../lib/logger.js';
import chalk from 'chalk';
import { startPolling, pingIntervalId, startPollingForTunnel, stopTunnelHelper, isTunnelPolling } from '../lib/utils.js';
import { unlinkSync } from 'fs';
import constants from '../lib/constants.js';
import fs from 'fs';

const uploadDomToS3ViaEnv = process.env.USE_LAMBDA_INTERNAL || false;
export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Finalizing build`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'finalizeBuild'});

            try {
                if (ctx.build.id) {
                    await ctx.client.finalizeBuild(ctx.build.id, ctx.totalSnapshots, ctx.log);
                }
                if (ctx.build.hasDiscoveryError){
                    ctx.log.warn(`We found some network errors while capturing DOM snapshots. These network errors may cause visual differences in your screenshots. Please go to ${ctx.build.url} for more details`);
                }
            } catch (error: any) {
                ctx.log.debug(error);
                task.output = chalk.gray(error.message);
                throw new Error('Finalize build failed');
            }
            let buildUrls = `build url: ${ctx.build.url}\n`;

            if (pingIntervalId !== null) {
                clearInterval(pingIntervalId);
                ctx.log.debug('Ping polling stopped immediately from Finalize Build');
            }
            
            for (const [sessionId, capabilities] of ctx.sessionCapabilitiesMap.entries()) {
                try {
                    const buildId = capabilities?.buildId || '';
                    const projectToken = capabilities?.projectToken || '';
                    const totalSnapshots = capabilities?.snapshotCount || 0;
                    const sessionBuildUrl = capabilities?.buildURL || '';
                    const testId = capabilities?.id || '';

                    if (ctx.options.fetchResults && ctx.fetchResultsForBuild) {
                        if (!ctx.fetchResultsForBuild.includes(buildId)) {
                            let is_baseline;
                            if (capabilities.baseline) {
                                is_baseline = true;
                            } else {
                                is_baseline = false;
                            }
                            startPolling(ctx, buildId, is_baseline, capabilities.projectToken);
                            await new Promise(resolve => setTimeout(resolve, 7000));
                            ctx.fetchResultsForBuild.push(buildId);
                        }
                    }
                    ctx.log.debug(`Capabilities for sessionId ${sessionId}: ${JSON.stringify(capabilities)}`)
                    if (buildId && projectToken) {
                        await ctx.client.finalizeBuildForCapsWithToken(buildId, totalSnapshots, projectToken, ctx.log);
                        if (ctx.autoTunnelStarted) {
							await startPollingForTunnel(ctx, buildId, false, projectToken, capabilities?.buildName);
						}
                    }

                    if (testId && buildId) {
                        buildUrls += `TestId ${testId}: ${sessionBuildUrl}\n`;
                    }
                } catch (error: any) {
                    ctx.log.debug(`Error finalizing build for session ${sessionId}: ${error.message}`);
                }
            }
            task.output = chalk.gray(buildUrls);
            task.title = 'Finalized build';

            //If Tunnel Details are present, start polling for tunnel status 
			if (ctx.tunnelDetails && ctx.tunnelDetails.tunnelHost != "" && ctx.build?.id) {
				await startPollingForTunnel(ctx, ctx.build.id, false, '', '');
			} 
			//stop the tunnel if it was auto started and no tunnel polling is active
			if (ctx.autoTunnelStarted && isTunnelPolling === null) {
                await stopTunnelHelper(ctx);
            }
           
            // cleanup and upload logs
            try {
                await ctx.browser?.close();
                ctx.log.debug(`Closed browser`);
                await ctx.server?.close();
                ctx.log.debug(`Closed server`);
                if (ctx.isSnapshotCaptured) {
                    let uploadCLILogsToS3 = ctx.config.useLambdaInternal || uploadDomToS3ViaEnv;
                    if (!uploadCLILogsToS3) {
                        ctx.log.debug(`Log file to be uploaded`)
                        let resp = await ctx.client.getS3PreSignedURL(ctx);
                        await ctx.client.uploadLogs(ctx, resp.data.url);
                    } else {
                        ctx.log.debug(`Log file to be uploaded via LSRS`)
                        let resp = ctx.client.sendCliLogsToLSRS(ctx);
                    }
                }
                if (process.exitCode && process.exitCode !== 0) {
                    ctx.log.error(`Exiting process with code ${process.exitCode}`);
                    task.output = chalk.gray(`Exiting process with code ${process.exitCode}`);
                    task.title = 'Build finalized with errors';
                    throw new Error(`Process exited with code ${process.exitCode}`);
                }
            } catch (error: any) {
                ctx.log.debug(error);
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}