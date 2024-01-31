import { Context, Env, Config } from '../types.js'
import { DEFAULT_CONFIG } from './config.js'
import { version } from '../../package.json'
import { validateConfig } from './schemaValidation.js'
import logger from './logger.js'
import getEnv from './env.js'
import httpClient from './httpClient.js'
import fs from 'fs'

export default (options: Record<string, string>): Context => {
    let env: Env = getEnv();
    let viewports: Array<{width: number, height: number}> = []
    let config: Config = DEFAULT_CONFIG;

    try {
        if (options.config) {
            config = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
            // resolutions supported for backward compatibility
            if (config.web.resolutions) {
                config.web.viewports = config.web.resolutions;
                delete config.web.resolutions;
            }
        }
        
        // validate config
        if (!validateConfig(config)) throw new Error(validateConfig.errors[0].message);
    } catch (error: any) {
        console.log(`[smartui] Error: ${error.message}`);
        process.exit();
    }

    for (let viewport of config.web.viewports) viewports.push({ width: viewport[0], height: viewport[1] || 0});
    return {
        env: env,
        log: logger,
        client: new httpClient(env),
        webConfig: {
            browsers: config.web.browsers,
            viewports: viewports,
            waitForPageRender: config.web.waitForPageRender || 0,
            waitForTimeout: config.web.waitForTimeout || 0
        },
        webStaticConfig: [],
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
        cliVersion: version,
        totalSnapshots: -1
    }
}