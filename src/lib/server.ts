import { Server, IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import { readFileSync, truncate } from 'fs'
import { Context } from '../types.js'
import { validateSnapshot } from './schemaValidation.js'
import { pingIntervalId } from './utils.js';
import { startPolling } from './utils.js';

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
		
			// Fetch sessionId from snapshot options if present
			const sessionId = snapshot?.options?.sessionId;
			let capsBuildId = ''

			if (sessionId) {
				// Check if sessionId exists in the map
				if (ctx.sessionCapabilitiesMap?.has(sessionId)) {
					// Use cached capabilities if available
					const cachedCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
					capsBuildId = cachedCapabilities?.buildId || ''
				} else {
					// If not cached, fetch from API and cache it
					try {
						let fetchedCapabilitiesResp = await ctx.client.getSmartUICapabilities(sessionId, ctx.config, ctx.git, ctx.log);
						capsBuildId = fetchedCapabilitiesResp?.buildId || ''
						ctx.log.debug(`fetch caps for sessionId: ${sessionId} are ${JSON.stringify(fetchedCapabilitiesResp)}`)
						if (capsBuildId) {
							ctx.sessionCapabilitiesMap.set(sessionId, fetchedCapabilitiesResp);
						} else if (fetchedCapabilitiesResp && fetchedCapabilitiesResp?.sessionId) {
							ctx.sessionCapabilitiesMap.set(sessionId, fetchedCapabilitiesResp);
						}
					} catch (error: any) {
						ctx.log.debug(`Failed to fetch capabilities for sessionId ${sessionId}: ${error.message}`);
						console.log(`Failed to fetch capabilities for sessionId ${sessionId}: ${error.message}`);
					}
				}
			}

			ctx.testType = testType;
			ctx.snapshotQueue?.enqueue(snapshot);
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
			await ctx.client.finalizeBuild(ctx.build.id, ctx.totalSnapshots, ctx.log);
			await ctx.browser?.close();
			if (ctx.server){
				ctx.server.close();
			}
			let resp = await ctx.client.getS3PreSignedURL(ctx);
            await ctx.client.uploadLogs(ctx, resp.data.url);

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

	

	await server.listen({ port: ctx.options.port });
	// store server's address for SDK
	let { port } = server.addresses()[0];
	process.env.SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;
	process.env.CYPRESS_SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;

	return server;
}
