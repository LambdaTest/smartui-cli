import { Server, IncomingMessage, ServerResponse } from 'http'
import { FastifyInstance } from 'fastify'
import httpClient from './lib/httpClient.js'
import type { Logger } from 'winston'


export interface Context {
    env: Env;
    log: Logger;
    server?: FastifyInstance<Server, IncomingMessage, ServerResponse>;
    client: httpClient;
    config: {
        browsers: Array<string>;
        viewports: Array<{width: number, height: number}>;
    };
    staticConfig: WebStaticConfigSchema;
    build: Build;
    git: Git;
    args: {
        execCommand?: Array<string>
    }
    cliVersion: string;
    
}

export interface Env {
    PROJECT_TOKEN: string;
    SMARTUI_CLIENT_API_URL: string;
    SMARTUI_LOG_LEVEL: string | undefined;
    SMARTUI_DEBUG: string | undefined;
}

export interface Snapshot {
    name: string;
    dom: string;
}

export interface Git {
    branch: string;
    commitId: string;
    commitAuthor: string;
    commitMessage: string;
    githubURL?: string;
}

export interface Build {
    id: string;
    name: string;
    url: string;
    baseline: boolean;
    projectId: string;
}

export interface WebConfigSchema {
    web: {
        browsers: Array<string>;
        viewports?: Array<Array<number>>;
        resolutions?: Array<Array<number>>; // for backward compatibility
    }
}

export type WebStaticConfigSchema = Array<{
    name: string;
    url: string;
    waitForTimeout?: number
}>;
