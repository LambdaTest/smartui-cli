import { Context, Env, WebConfigSchema, WebStaticConfigSchema } from '../types.js'
import { DEFAULT_WEB_CONFIG, DEFAULT_WEB_STATIC_CONFIG } from './config.js'
import { version } from '../../package.json'
import logger from '../lib/logger.js'
import getEnv from '../lib/env.js'
import httpClient from './httpClient.js'
import fs from 'fs'

export default (options: Record<string, string>): Context => {
    let env: Env = getEnv();
    let viewports: Array<{width: number, height: number}> = []
    let webConfig: WebConfigSchema = DEFAULT_WEB_CONFIG;

    try {
        if (options.config) {
            webConfig = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
        }
        for (let viewport of webConfig.web.viewports) {
            viewports.push({ width: viewport[0], height: viewport[1]})
        }
    } catch (error: any) {
        throw new Error(error.message);
    }
    // TODO: validate config

    return {
        env: env,
        log: logger,
        client: new httpClient(env),
        config: {
            browsers: webConfig.web.browsers,
            viewports: viewports
        },
        staticConfig: [],
        git: {
            branch: '',
            commitId: '',
            commitAuthor: '',
            commitMessage: '',
            githubURL: ''
        },
        build: {
            id: '',
            name: '',
            baseline: false,
            url: '',
            projectId: '',
        },
        args: {},
        cliVersion: version
    }
}