import { Server, IncomingMessage, ServerResponse } from 'http'
import { FastifyInstance } from 'fastify'
import httpClient from './lib/httpClient.js'
import type { Logger } from 'winston'
import { ListrTaskWrapper, ListrRenderer } from "listr2";
import { Browser } from '@playwright/test';

export interface Context {
    env: Env;
    log: Logger;
    task?: ListrTaskWrapper<Context, typeof ListrRenderer, typeof ListrRenderer>;
    server?: FastifyInstance<Server, IncomingMessage, ServerResponse>;
    client: httpClient;
    browser?: Browser;
    webConfig: {
        browsers: Array<string>;
        viewports: Array<{width: number, height: number}>;
        waitForPageRender: number;
        waitForTimeout: number;
    };
    webStaticConfig: WebStaticConfig;
    build: Build;
    git: Git;
    args: {
        execCommand?: Array<string>
    }
    cliVersion: string;
    totalSnapshots: number;
}

export interface Env {
    PROJECT_TOKEN: string;
    SMARTUI_CLIENT_API_URL: string;
    LT_SDK_LOG_LEVEL: string | undefined;
    LT_SDK_DEBUG: string | undefined;
}

export interface Snapshot {
    url: string;
    name: string;
    dom: Record<string, any>;
    options?: {
        ignoreDOM?: {
            id?: Array<string>,
            class?: Array<string>,
            cssSelector?: Array<string>,
            xpath?: Array<string>
        },
        selectDOM?: {
            id?: Array<string>,
            class?: Array<string>,
            cssSelector?: Array<string>,
            xpath?: Array<string>
        }
    }
}

export interface ProcessedSnapshot {
    url: string,
    name: string,
    dom: string,
    options: {
        ignoreBoxes?: Record<string, Array<Record<string, number>>>,
        selectBoxes?: Record<string, Array<Record<string, number>>>
    }
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

export interface Config {
    web: WebConfig
}

export interface WebConfig {
    browsers: Array<string>;
    viewports?: Array<Array<number>>;
    resolutions?: Array<Array<number>>; // for backward compatibility
    waitForPageRender?: number;
    waitForTimeout?: number;
}

export type WebStaticConfig = Array<{
    name: string;
    url: string;
    waitForTimeout?: number
}>;
