import { Server, IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import { readFileSync, truncate } from 'fs'
import { Context } from '../types.js'
import { Logger } from 'winston'
import { validateSnapshot } from './schemaValidation.js'
import { pingIntervalId, startPollingForTunnel, stopTunnelHelper, isTunnelPolling } from './utils.js';
import constants from './constants.js';
var fp = require("find-free-port")

const uploadDomToS3ViaEnv = process.env.USE_LAMBDA_INTERNAL || false;

// Helper function to find an available port
async function findAvailablePort(server: FastifyInstance, startPort: number, log: Logger): Promise<number> {
	let currentPort = startPort;

	try {
		await server.listen({ port: currentPort });
		return currentPort;
	} catch (error: any) {
		if (error.code === 'EADDRINUSE') {
			log.debug(`Port ${currentPort} is in use, finding available port in range ${constants.MIN_PORT_RANGE}-${constants.MAX_PORT_RANGE}`);

			const maxRetries = 3;
			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					const availablePorts = await fp(constants.MIN_PORT_RANGE, constants.MAX_PORT_RANGE);
					if (availablePorts.length > 0) {
						const freePort = availablePorts[0];
						await server.listen({ port: freePort });
						log.debug(`Found and started server on port ${freePort}`);
						return freePort;
					} else {
						throw new Error(`No available ports found in range ${constants.MIN_PORT_RANGE}-${constants.MAX_PORT_RANGE}`);
					}
				} catch (retryError: any) {
					if (retryError.code === 'EADDRINUSE' && attempt < maxRetries) {
						log.debug(`Port race condition on attempt ${attempt}, retrying...`);
						continue;
					}
					throw retryError;
				}
			}

			throw new Error('Failed to find available port after max retries');
		} else {
			throw error;
		}
	}
}

export default async (ctx: Context): Promise<FastifyInstance<Server, IncomingMessage, ServerResponse>> => {

	const server: FastifyInstance<Server, IncomingMessage, ServerResponse> = fastify({
		logger: {
			level: 'debug',
			stream: { write: (message) => { ctx.log.debug(message) } }
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
		reply.code(200).send({ data: { dom: SMARTUI_DOM } });
	});

	// process and upload snpashot
	server.post('/snapshot', opts, async (request, reply) => {
		let replyCode: number;
		let replyBody: Record<string, any>;

		try {
			let { snapshot, testType } = request.body;
			if (!validateSnapshot(snapshot)) throw new Error(validateSnapshot.errors[0].message);

			if (snapshot?.options?.approvalThreshold !== undefined && snapshot?.options?.rejectionThreshold !== undefined) {
				if (snapshot?.options?.rejectionThreshold <= snapshot?.options?.approvalThreshold) {
					throw new Error(`Invalid snapshot options; rejectionThreshold (${snapshot.options.rejectionThreshold}) must be greater than approvalThreshold (${snapshot.options.approvalThreshold})`);
				}
			}
			snapshot.name = snapshot?.name?.trim();

			// Fetch sessionId from snapshot options if present
			const sessionId = snapshot?.options?.sessionId;
			let capsBuildId = ''
			const contextId = snapshot?.options?.contextId;

			if (sessionId) {
				if (ctx.sessionTestIdMap?.has(sessionId)) {
					// Already have testId from LTMS fallback, skip getSmartUICapabilities
					const cachedTestId = ctx.sessionTestIdMap.get(sessionId);
					snapshot.options.testId = cachedTestId;
					ctx.log.debug(`Using cached testId for sessionId ${sessionId}: ${snapshot.options.testId}`);
					if (cachedTestId && ctx.testIdTestNameMap?.has(cachedTestId)) {
						snapshot.options.testName = ctx.testIdTestNameMap.get(cachedTestId);
						ctx.log.debug(`Using cached testName for testId ${cachedTestId}: ${snapshot.options.testName}`);
					}
				} else if (ctx.sessionCapabilitiesMap?.has(sessionId)) {
					// Use cached capabilities if available
					const cachedCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
					capsBuildId = cachedCapabilities?.buildId || ''
					const cachedTestName = cachedCapabilities?.testName || cachedCapabilities?.name;
					if (cachedTestName) {
						snapshot.options.testName = cachedTestName;
						if (cachedCapabilities?.id) {
							ctx.testIdTestNameMap?.set(cachedCapabilities.id, cachedTestName);
						}
					}
				} else {
					// If not cached, fetch from API and cache it
					try {
						let fetchedCapabilitiesResp = await ctx.client.getSmartUICapabilities(sessionId, ctx.config, ctx.git, ctx.log, ctx.isStartExec, ctx.options.baselineBuild, ctx.env);
						capsBuildId = fetchedCapabilitiesResp?.buildId || ''
						ctx.log.debug(`fetch caps for sessionId: ${sessionId} are ${JSON.stringify(fetchedCapabilitiesResp)}`)
						const fetchedTestName = fetchedCapabilitiesResp?.testName || fetchedCapabilitiesResp?.name;
						if (fetchedTestName) {
							snapshot.options.testName = fetchedTestName;
							const testIdForCache = fetchedCapabilitiesResp?.id || fetchedCapabilitiesResp?.testId;
							if (testIdForCache) {
								ctx.testIdTestNameMap?.set(testIdForCache, fetchedTestName);
							}
						}
						if (capsBuildId) {
							ctx.sessionCapabilitiesMap.set(sessionId, fetchedCapabilitiesResp);
						} else if (fetchedCapabilitiesResp && fetchedCapabilitiesResp?.sessionId) {
							ctx.sessionCapabilitiesMap.set(sessionId, fetchedCapabilitiesResp);
						} else if (fetchedCapabilitiesResp?.testId && !capsBuildId) {
							// LTMS fallback: only testId returned, no buildId
							ctx.sessionTestIdMap?.set(sessionId, fetchedCapabilitiesResp.testId);
							snapshot.options.testId = fetchedCapabilitiesResp.testId;
							if (fetchedTestName) {
								ctx.testIdTestNameMap?.set(fetchedCapabilitiesResp.testId, fetchedTestName);
							}
							ctx.log.debug(`Cached LTMS fallback testId for sessionId ${sessionId}: ${fetchedCapabilitiesResp.testId}`);
						}
					} catch (error: any) {
						ctx.log.debug(`Failed to fetch capabilities for sessionId ${sessionId}: ${error.message}`);
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
				ctx.contextToSnapshotMap.set(contextId, '0');
				ctx.log.debug(`Marking contextId as captured and added to queue: ${contextId}`);
			}

			if (contextId) {
				ctx.snapshotQueue?.enqueueFront(snapshot);
			} else {
				ctx.snapshotQueue?.enqueue(snapshot);
			}

			ctx.isSnapshotCaptured = true;
			replyCode = 200;
			replyBody = { data: { message: "success", warnings: [] } };
		} catch (error: any) {
			ctx.log.debug(`snapshot failed; ${error}`)
			replyCode = 500;
			replyBody = { error: { message: error.message } }
		}

		return reply.code(replyCode).send(replyBody);
	});

	server.post('/stop', opts, async (_, reply) => {
		let replyCode: number;
		let replyBody: Record<string, any>;
		try {
			ctx.log.info('Received stop command. Finalizing build ...');
			if (ctx.config.delayedUpload) {
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
			let buildUrls = `build url: ${ctx.build.url}\n`;

			for (const [sessionId, capabilities] of ctx.sessionCapabilitiesMap.entries()) {
				try {
					const buildId = capabilities?.buildId || '';
					const projectToken = capabilities?.projectToken || '';
					const totalSnapshots = capabilities?.snapshotCount || 0;
					const sessionBuildUrl = capabilities?.buildURL || '';
					const testId = capabilities?.id || '';
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


			//If Tunnel Details are present, start polling for tunnel status 
			if (ctx.tunnelDetails && ctx.tunnelDetails.tunnelHost != "" && ctx.build?.id) {
				await startPollingForTunnel(ctx, ctx.build.id, false, '', '');
			}
			//stop the tunnel if it was auto started and no tunnel polling is active
			if (ctx.autoTunnelStarted && isTunnelPolling === null) {
				await stopTunnelHelper(ctx);
			}

			await ctx.browser?.close();
			if (ctx.server) {
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

		ctx.log.info('Stop command processed. Tearing down server.');

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
			const { contextId, pollTimeout, snapshotName: rawSnapshotName } = request.query as { contextId: string, pollTimeout: number, snapshotName: string };
			const snapshotName = rawSnapshotName?.trim();
			if (!contextId || !snapshotName) {
				throw new Error('contextId and snapshotName are required parameters');
			}


			const timeoutDuration = pollTimeout * 1000 || 30000;

			// Check if we have stored snapshot status for this contextId
			if (ctx.contextToSnapshotMap?.has(contextId)) {
				let contextStatus = ctx.contextToSnapshotMap.get(contextId);

				let counter = 60;
				while (contextStatus === '0') {
					if (counter <= 0) {
						throw new Error('Snapshot processing failed');
					}
					contextStatus = ctx.contextToSnapshotMap.get(contextId);
					// Wait 5 seconds before next check
					await new Promise(resolve => setTimeout(resolve, 5000));
					counter--;
				}

				if (contextStatus === '2') {
					throw new Error("Snapshot Failed");
				}

				ctx.log.debug("Snapshot uploaded successfully");

				const buildId = contextStatus;
				if (!buildId) {
					throw new Error(`No buildId found for contextId: ${contextId}`);
				}

				// Poll external API until it returns 200 or timeout is reached
				let lastExternalResponse: any = null;
				const startTime = Date.now();

				while (true) {
					try {
						const externalResponse = await ctx.client.getSnapshotStatus(
							buildId,
							snapshotName,
							contextId,
							ctx
						);

						lastExternalResponse = externalResponse;

						if (externalResponse.statusCode === 200) {
							replyCode = 200;
							replyBody = externalResponse.data;
							replyBody.error = externalResponse.error.message
							return reply.code(replyCode).send(replyBody);
						} else if (externalResponse.statusCode === 202) {
							replyBody = externalResponse.data;
							ctx.log.debug(`External API attempt: Still processing, Pending Screenshots ${externalResponse.snapshotCount}`);
							await new Promise(resolve => setTimeout(resolve, 5000));
						} else if (externalResponse.statusCode === 404) {
							ctx.log.debug(`Snapshot still processing, not uploaded`);
							await new Promise(resolve => setTimeout(resolve, 5000));
						} else {
							ctx.log.debug(`Unexpected response from external API: ${JSON.stringify(externalResponse)}`);
							replyCode = 500;
							return reply.code(replyCode).send(externalResponse);
						}

						ctx.log.debug(`timeoutDuration: ${timeoutDuration}`);
						ctx.log.debug(`Time passed: ${Date.now() - startTime}`);

						if (Date.now() - startTime > timeoutDuration) {
							replyCode = 202;
							replyBody = lastExternalResponse.data;
							replyBody.error = `Request timed out, Snapshot still processing (timeoutDuration: ${timeoutDuration / 1000}s, buildId: ${buildId}, snapshotName: ${snapshotName}, contextId: ${contextId})`;
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

	// Get smartui results (aggregated visual count per session/build)
	server.get('/smartui/results', opts, async (request, reply) => {
		let replyCode: number;
		let replyBody: Record<string, any>;

		try {
			const { sessionId } = request.query as { sessionId?: string };
			ctx.log.debug(`smartui results request: sessionId=${sessionId || 'none'}`);

			// Resolve buildId and projectToken from session capabilities or active build
			let resolvedBuildId = '';
			let projectToken = '';

			if (sessionId) {
				if (ctx.sessionCapabilitiesMap?.has(sessionId)) {
					// Use cached capabilities if available
					const cachedCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
					resolvedBuildId = cachedCapabilities?.buildId || '';
					projectToken = cachedCapabilities?.projectToken || '';
					ctx.log.debug(`Resolved from sessionCapabilitiesMap for sessionId ${sessionId}: buildId=${resolvedBuildId}, projectToken=${projectToken ? 'present' : 'missing'}`);
				} else {
					// If not cached, fetch from API and cache it (same as snapshot flow)
					try {
						const fetchedCapabilitiesResp = await ctx.client.getSmartUICapabilities(sessionId, ctx.config, ctx.git, ctx.log, ctx.isStartExec, ctx.options.baselineBuild, ctx.env);
						resolvedBuildId = fetchedCapabilitiesResp?.buildId || '';
						projectToken = fetchedCapabilitiesResp?.projectToken || '';
						ctx.log.debug(`Fetched caps for sessionId: ${sessionId} are ${JSON.stringify(fetchedCapabilitiesResp)}`);
						if (resolvedBuildId) {
							ctx.sessionCapabilitiesMap.set(sessionId, fetchedCapabilitiesResp);
						} else if (fetchedCapabilitiesResp && fetchedCapabilitiesResp?.sessionId) {
							ctx.sessionCapabilitiesMap.set(sessionId, fetchedCapabilitiesResp);
						}
					} catch (error: any) {
						ctx.log.debug(`Failed to fetch capabilities for sessionId ${sessionId}: ${JSON.stringify(error)}`);
					}
				}
			}
			// Skip automation buildIds (short IDs) and fall back to ctx.build.id
			if ((!resolvedBuildId || resolvedBuildId.length <= 30) && ctx.build && ctx.build.id) {
				resolvedBuildId = ctx.build.id;
			}
			if (!projectToken) {
				projectToken = ctx.env.PROJECT_TOKEN || '';
			}

			ctx.log.debug(`smartui results params: sessionId=${sessionId || 'none'}, buildId=${resolvedBuildId}, projectToken=${projectToken ? 'present' : 'missing'}`);
			if (!resolvedBuildId) {
				replyCode = 404;
				replyBody = { error: { message: 'Unable to determine buildId. Ensure a SmartUI build is active.' } };
				return reply.code(replyCode).send(replyBody);
			}

			const resp = await ctx.client.getScreenshotData(
				resolvedBuildId,
				false,
				ctx.log,
				projectToken,
				'',
				sessionId || '',
				'smartui-results'
			);

			replyCode = 200;
			replyBody = resp;
		} catch (error: any) {
			const errMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
			ctx.log.debug(`smartui results failed; ${errMsg}`);
			replyCode = 500;
			replyBody = { error: { message: `smartui results failed; ${errMsg}` } };
		}

		return reply.code(replyCode).send(replyBody);
	});

	// Get build info
	server.get('/build/info', opts, async (request, reply) => {
		let replyCode: number;
		let replyBody: Record<string, any>;

		try {
			if (ctx.build && ctx.build.id) {
				const buildInfo = ctx.build;
				const data = {
					buildId: buildInfo.id,
					buildName: buildInfo.name,
					baseline: buildInfo.baseline,
					projectToken: ctx.env.PROJECT_TOKEN || '',
				}
				replyCode = 200;
				replyBody = { data: data };
			} else {
				throw new Error('Build information is not available');
			}
		} catch (error: any) {
			ctx.log.debug(`build info failed; ${error}`);
			replyCode = 500;
			replyBody = { error: { message: error.message } };
		}

		return reply.code(replyCode).send(replyBody);

	});

	// Use the helper function to find and start server on available port
	if (ctx.sourceCommand && ctx.sourceCommand === 'exec-start') {

		await server.listen({ port: ctx.options.port });
		let { port } = server.addresses()[0];
		process.env.SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;
		process.env.CYPRESS_SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;
		ctx.log.debug(`Server started successfully on port ${port}`);

	} else {
		const actualPort = await findAvailablePort(server, ctx.options.port, ctx.log);
		process.env.SMARTUI_SERVER_ADDRESS = `http://localhost:${actualPort}`;
		process.env.CYPRESS_SMARTUI_SERVER_ADDRESS = `http://localhost:${actualPort}`;
		ctx.log.debug(`Server started successfully on port ${actualPort}`);
	}

	return server;
}
