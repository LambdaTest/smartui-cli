import { Server, IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fastify, { FastifyInstance, RouteShorthandOptions } from 'fastify';
import { readFileSync } from 'fs'
import { Context } from '../types.js'
import processSnapshot from './processSnapshot.js'
import { validateSnapshot } from './schemaValidation.js'

export default async (ctx: Context): Promise<FastifyInstance<Server, IncomingMessage, ServerResponse>> => {
	
	const server: FastifyInstance<Server, IncomingMessage, ServerResponse> = fastify({ logger: false, bodyLimit: 10000000 });
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

	// upload snpashot
	server.post('/snapshot', opts, async (request, reply) => {
		try {
			let { snapshot, testType } = request.body;
			if (!validateSnapshot(snapshot)) throw new Error(validateSnapshot.errors[0].message);
			let { processedSnapshot, warnings } = await processSnapshot(snapshot, ctx);
			await ctx.client.uploadSnapshot(ctx.build.id, processedSnapshot, testType, ctx.log);

			ctx.totalSnapshots++
			reply.code(200).send({data: { message: "success", warnings }});
		} catch (error: any) {
			return reply.code(500).send({ error: { message: error.message}});
		}
	});


	await server.listen();
	// store server's address for SDK
	let { port } = server.addresses()[0];
	process.env.SMARTUI_SERVER_ADDRESS = `http://localhost:${port}`;

	return server;
}
