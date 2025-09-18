import { ListrTask, ListrRendererFactory } from 'listr2';
import { Context } from '../types.js'
import chalk from 'chalk';
import { updateLogContext } from '../lib/logger.js';
import { startTunnelBinary, startPollingForTunnel, stopTunnelHelper, startPingPolling } from '../lib/utils.js';

export default (ctx: Context): ListrTask<Context, ListrRendererFactory, ListrRendererFactory>  =>  {
    return {
        title: `Creating SmartUI build`,
        task: async (ctx, task): Promise<void> => {
            updateLogContext({task: 'createBuild'});

            try {
                if (ctx.authenticatedInitially && !ctx.config.skipBuildCreation) {
                    let resp = await ctx.client.createBuild(ctx.git, ctx.config, ctx.log, ctx.build.name, ctx.isStartExec, ctx.env.SMART_GIT, ctx.options.markBaseline, ctx.options.baselineBuild, ctx.options.scheduled,ctx.env.LT_USERNAME,ctx.env.LT_ACCESS_KEY);
                    if (resp && resp.data && resp.data.buildId) {
                        ctx.build = {
                            id: resp.data.buildId,
                            name: resp.data.buildName,
                            url: resp.data.buildURL,
                            baseline: resp.data.baseline,
                            useKafkaFlow: resp.data.useKafkaFlow || false,
                        }
                        process.env.SMARTUI_BUILD_ID = resp.data.buildId;
                        process.env.SMARTUI_BUILD_NAME = resp.data.buildName;
                    } else if (resp && resp.error) {
                        if (resp.error.message) {
                            ctx.log.error(`Error while creation of build: ${resp.error.message}`)
                            throw new Error(`Error while creation of build: ${resp.error.message}`);
                        }
                    }
                    if (ctx.build.id === '') {
                        ctx.log.debug('Build creation failed: Build ID is empty');
                        task.output = chalk.red('Build creation failed: Build ID is empty');
                        throw new Error('SmartUI build creation failed');
                    }
                    task.output = chalk.gray(`build id: ${resp.data.buildId}`);
                    task.title = 'SmartUI build created'
                    if (ctx.env.USE_REMOTE_DISCOVERY){
                        task.output += chalk.gray(`\n Using remote discovery for this build`);
                    }
                } else {
                    task.output = chalk.gray(`Empty PROJECT_TOKEN and PROJECT_NAME. Skipping Creation of Build!`)
                    task.title = 'Skipped SmartUI build creation'
                    if (ctx.config.tunnel && ctx.config.tunnel?.type === 'auto') {
                        await stopTunnelHelper(ctx)
                    }
                }

                if (ctx.config.tunnel && ctx.config.tunnel?.type === 'auto') {
                    if (ctx.build && ctx.build.id) {
                        startPollingForTunnel(ctx, '', false, '');
                    } else {
                        startPingPolling(ctx, "tunnel-process");
                    }
                }

                if (ctx.config.tunnel) {
                    let tunnelResp = await ctx.client.getTunnelDetails(ctx, ctx.log);
                    ctx.log.debug(`Tunnel Response: ${JSON.stringify(tunnelResp)}`)
                    if (tunnelResp && tunnelResp.data && tunnelResp.data.host && tunnelResp.data.port && tunnelResp.data.tunnel_name) {
                        ctx.tunnelDetails = {
                            tunnelHost: tunnelResp.data.host,
                            tunnelPort: tunnelResp.data.port,
                            tunnelName: tunnelResp.data.tunnel_name
                        }
                        ctx.log.debug(`Tunnel Details: ${JSON.stringify(ctx.tunnelDetails)}`)
                        //USE_REMOTE_DISCOVERY as default if Tunnel is true 
                        if (process.env.USE_REMOTE_DISCOVERY === undefined) {
                            ctx.env.USE_REMOTE_DISCOVERY = true;
                            process.env.USE_REMOTE_DISCOVERY = 'true';
                            task.output += chalk.gray(`\n Using remote discovery by deafult for this build`);
                        }
                        ctx.log.debug(`USE_REMOTE_DISCOVERY is set to ${ctx.env.USE_REMOTE_DISCOVERY}`);

                    } else if (tunnelResp && tunnelResp.error) {
                        if (tunnelResp.error.message) {
                            if (tunnelResp.error.code && tunnelResp.error.code === 400) {
                                ctx.log.warn(tunnelResp.error.message)
                            } else {
                                ctx.log.warn(`Error while fetch tunnel details; Either tunnel is not running or tunnel parameters are different`)
                            }
                        }
                    }
                }
            } catch (error: any) {
                ctx.log.debug(error);
                if (ctx.config.tunnel && ctx.config.tunnel?.type === 'auto') {
                    await stopTunnelHelper(ctx)
                }
                task.output = chalk.gray(error.message);
                throw new Error('SmartUI build creation failed');
            }
        },
        rendererOptions: { persistentOutput: true }
    }
}