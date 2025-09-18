import { Server, IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import { readFileSync, truncate } from 'fs'
import { Context } from '../types.js'
import { validateSnapshot } from './schemaValidation.js'
import { pingIntervalId } from './utils.js';
import { stopTunnelHelper } from './utils.js';

const uploadDomToS3ViaEnv = process.env.USE_LAMBDA_INTERNAL || false;
export default async (ctx: Context): Promise<FastifyInstance<Server, IncomingMessage, ServerResponse>> => {
	
	const server: FastifyInstance<Server, IncomingMessage, ServerResponse> = fastify({
		logger: {
			level: 'debug',
			stream: { write: (message) => { ctx.log.debug(message) }}
		},
		bodyLimit: 30000000
	});
	const opts: RouteShorthandOptions = {};
	const SMARTUI_DOM = readFileSync(path.resolve(__dirname, 'dom-serializer.js'), 'utf-8');

	// healthcheck
	server.get('/healthcheck', opts, (_, reply) => {
		reply.code(200).send({ cliVersion: ctx.cliVersion })
	})

	// send dom serializer
	server.get('/domserializer', opts, (request, reply) => {
		reply.code(200).send({ data: { dom: SMARTUI_DOM }});
	});

	// process and upload snpashot
	server.post('/snapshot', opts, async (request, reply) => {
		let replyCode: number;
		let replyBody: Record<string, any>;

		try {
			let { snapshot, testType } = request.body;
			if (!validateSnapshot(snapshot)) throw new Error(validateSnapshot.errors[0].message);

			if(snapshot?.options?.approvalThreshold !== undefined && snapshot?.options?.rejectionThreshold !== undefined) {
				if(snapshot?.options?.rejectionThreshold <= snapshot?.options?.approvalThreshold) {
					throw new Error(`Invalid snapshot options; rejectionThreshold (${snapshot.options.rejectionThreshold}) must be greater than approvalThreshold (${snapshot.options.approvalThreshold})`);
				}
			}
		
			// Fetch sessionId from snapshot options if present
			const sessionId = snapshot?.options?.sessionId;
			let capsBuildId = ''
			const contextId = snapshot?.options?.contextId;

			if (sessionId) {
				// Check if sessionId exists in the map
				if (ctx.sessionCapabilitiesMap?.has(sessionId)) {
					// Use cached capabilities if available
					const cachedCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
					capsBuildId = cachedCapabilities?.buildId || ''
				} else {
					// If not cached, fetch from API and cache it
					try {
						let fetchedCapabilitiesResp = await ctx.client.getSmartUICapabilities(sessionId, ctx.config, ctx.git, ctx.log, ctx.isStartExec);
						capsBuildId = fetchedCapabilitiesResp?.buildId || ''
						ctx.log.debug(`fetch caps for sessionId: ${sessionId} are ${JSON.stringify(fetchedCapabilitiesResp)}`)
						if (capsBuildId) {
							ctx.sessionCapabilitiesMap.set(sessionId, fetchedCapabilitiesResp);
						} else if (fetchedCapabilitiesResp && fetchedCapabilitiesResp?.sessionId) {
							ctx.sessionCapabilitiesMap.set(sessionId, fetchedCapabilitiesResp);
						}
					} catch (error: any) {
						ctx.log.debug(`Failed to fetch capabilities for sessionId ${sessionId}: ${error.message}`);
						// console.log(`Failed to fetch capabilities for sessionId ${sessionId}: ${error.message}`);
					}
				}

				if (capsBuildId && capsBuildId !== '') {
					process.env.SMARTUI_BUILD_ID = capsBuildId;
				}
			}

			ctx.testType = testType;
			
			if (contextId && !ctx.contextToSnapshotMap) {
				ctx.contextToSnapshotMap = new Map();
				ctx.log.debug(`Initialized empty context mapping map for contextId: ${contextId}`);
			}
			
			if (contextId && ctx.contextToSnapshotMap) {
				ctx.contextToSnapshotMap.set(contextId, 0);
				ctx.log.debug(`Marking contextId as captured and added to queue: ${contextId}`);
			}

			if(contextId){
				ctx.snapshotQueue?.enqueueFront(snapshot);
			}else{
				ctx.snapshotQueue?.enqueue(snapshot);	
			}
			
			ctx.isSnapshotCaptured = true;
			replyCode = 200;
			replyBody = { data: { message: "success", warnings: [] }};
		} catch (error: any) {
			ctx.log.debug(`snapshot failed; ${error}`)
			replyCode = 500;
			replyBody = { error: { message: error.message }}
		}
		
		return reply.code(replyCode).send(replyBody);
	});

	server.post('/stop', opts, async (_, reply) => {
		let replyCode: number;
		let replyBody: Record<string, any>;
		try {
			if(ctx.config.delayedUpload){
				ctx.log.debug("started after processing because of delayedUpload")
				ctx.snapshotQueue?.startProcessingfunc()
			}
			await new Promise((resolve) => {
				const intervalId = setInterval(() => {
					if (ctx.snapshotQueue?.isEmpty() && !ctx.snapshotQueue?.isProcessing()) {
						clearInterval(intervalId);
						resolve();
					}
				}, 1000);
			})

			for (const [sessionId, capabilities] of ctx.sessionCapabilitiesMap.entries()) {
                try {
                    const buildId = capabilities?.buildId || '';
                    const projectToken = capabilities?.projectToken || '';
                    const totalSnapshots = capabilities?.snapshotCount || 0;
                    const sessionBuildUrl = capabilities?.buildURL || '';
                    const testId = capabilities?.id || '';

                    if (buildId && projectToken) {
                        await ctx.client.finalizeBuildForCapsWithToken(buildId, totalSnapshots, projectToken, ctx.log);
                    }

                    if (testId && buildId) {
                        buildUrls += `TestId ${testId}: ${sessionBuildUrl}\n`;
                    }
                } catch (error: any) {
                    ctx.log.debug(`Error finalizing build for session ${sessionId}: ${error.message}`);
                }
            }

			if (ctx.build && ctx.build.id) {
				await ctx.client.finalizeBuild(ctx.build.id, ctx.totalSnapshots, ctx.log);
				let uploadCLILogsToS3 = ctx?.config?.useLambdaInternal || uploadDomToS3ViaEnv;
				if (!uploadCLILogsToS3) {
					ctx.log.debug(`Log file to be uploaded`)
					let resp = await ctx.client.getS3PreSignedURL(ctx);
					await ctx.client.uploadLogs(ctx, resp.data.url);
				} else {
					ctx.log.debug(`Skipping upload of CLI logs as useLambdaInternal is set`)
				}
			}

			//Handle Tunnel closure
			if (ctx.config.tunnel && ctx.config.tunnel?.type === 'auto') {
				await stopTunnelHelper(ctx)
			}

			await ctx.browser?.close();
			if (ctx.server){
				ctx.server.close();
			}

			if (pingIntervalId !== null) {
				clearInterval(pingIntervalId);
				ctx.log.debug('Ping polling stopped immediately.');
			}
			replyCode = 200;
			replyBody = { data: { message: "success", type: "DELETE" } };
		} catch (error: any) {
			ctx.log.debug(error);
			ctx.log.debug(`stop endpoint failed; ${error}`);
			replyCode = 500;
			replyBody = { error: { message: error.message } };
		}
		
		// Step 5: Return the response
		return reply.code(replyCode).send(replyBody);
	});

	// Add /ping route to check server status
	server.get('/ping', opts, (_, reply) => {
		reply.code(200).send({ status: 'Server is running', version: ctx.cliVersion });
	});

	// Get snapshot status
	server.get('/snapshot/status', opts, async (request, reply) => {
		let replyCode: number;
		let replyBody: Record<string, any>;


		try {
			ctx.log.debug(`request.query : ${JSON.stringify(request.query)}`);
			const { contextId, pollTimeout, snapshotName } = request.query as { contextId: string, pollTimeout: number, snapshotName: string };
			if (!contextId || !snapshotName) {
				throw new Error('contextId and snapshotName are required parameters');
			}

			const timeoutDuration = pollTimeout*1000 || 30000; 

			// Check if we have stored snapshot status for this contextId
			if (ctx.contextToSnapshotMap?.has(contextId)) {
				let contextStatus = ctx.contextToSnapshotMap.get(contextId);
				
				while (contextStatus==0) {
					// Wait 5 seconds before next check
					await new Promise(resolve => setTimeout(resolve, 5000));
					
					contextStatus = ctx.contextToSnapshotMap.get(contextId);
				}

				if(contextStatus==2){
					throw new Error("Snapshot Failed");
				}
				
				ctx.log.debug("Snapshot uploaded successfully");

				// Poll external API until it returns 200 or timeout is reached
				let lastExternalResponse: any = null; 
				const startTime = Date.now(); 

				while (true) {
					try {
						const externalResponse = await ctx.client.getSnapshotStatus(
							snapshotName,
							contextId,
							ctx
						);
						
						lastExternalResponse = externalResponse;

						if (externalResponse.statusCode === 200) {
							replyCode = 200;
							replyBody = externalResponse.data;
							return reply.code(replyCode).send(replyBody);
						} else if (externalResponse.statusCode === 202 ) {
							replyBody= externalResponse.data;
							ctx.log.debug(`External API attempt: Still processing, Pending Screenshots ${externalResponse.snapshotCount}`);
							await new Promise(resolve => setTimeout(resolve, 5000));
						}else if(externalResponse.statusCode===404){
							ctx.log.debug(`Snapshot still processing, not uploaded`);
							await new Promise(resolve => setTimeout(resolve, 5000));
						}else {
							ctx.log.debug(`Unexpected response from external API: ${JSON.stringify(externalResponse)}`);
							replyCode = 500;
							replyBody = { 
								error: { 
									message: `Unexpected response from external API: ${externalResponse.statusCode}`,
									externalApiStatus: externalResponse.statusCode
								}
							};
							return reply.code(replyCode).send(replyBody);
						}

						ctx.log.debug(`timeoutDuration: ${timeoutDuration}`);
						ctx.log.debug(`Time passed: ${Date.now() - startTime}`);

						if (Date.now() - startTime > timeoutDuration) {
							replyCode = 202; 
							replyBody = {
								data: {
									message: 'Request timed out-> Snapshot still processing'
								} 
							};
							return reply.code(replyCode).send(replyBody);
						}

					} catch (externalApiError: any) {
						ctx.log.debug(`External API call failed: ${externalApiError.message}`);
						replyCode = 500;
						replyBody = { 
							error: { 
								message: `External API call failed: ${externalApiError.message}`
							}
						};
						return reply.code(replyCode).send(replyBody);
					}
				}
			} else {
				// No snapshot found for this contextId
				replyCode = 404;
				replyBody = { error: { message: `No snapshot found for contextId: ${contextId}` } };
				return reply.code(replyCode).send(replyBody);
			}
		} catch (error: any) {
			ctx.log.debug(`snapshot status failed; ${error}`);
			replyCode = 500;
			replyBody = { error: { message: error.message } };
			return reply.code(replyCode).send(replyBody);
		}
	});


	await server.listen({ port: ctx.options.port });
	// store server's address for SDK
	let { port } = server.addresses()[0];
	process.env.SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;
	process.env.CYPRESS_SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;

	return server;
}
