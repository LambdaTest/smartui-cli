import { Server, IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import { readFileSync } from 'fs'
import { Context } from '../types.js'
import { validateSnapshot } from './schemaValidation.js'

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
			ctx.testType = testType;
			const start = ctx.config.deferUploads ? false : true;
			ctx.snapshotQueue?.enqueue(snapshot, start);
			replyCode = 200;
			replyBody = { data: { message: "success", warnings: [] }};
		} catch (error: any) {
			ctx.log.debug(`snapshot failed; ${error}`)
			replyCode = 500;
			replyBody = { error: { message: error.message }}
		}
		
		return reply.code(replyCode).send(replyBody);
	});

	await server.listen({ port: ctx.options.port });
	// store server's address for SDK
	let { port } = server.addresses()[0];
	process.env.SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;
	process.env.CYPRESS_SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;

	return server;
}
