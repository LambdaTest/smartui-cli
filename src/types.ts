import { Server, IncomingMessage, ServerResponse } from 'http'
import { FastifyInstance } from 'fastify'
import httpClient from './lib/httpClient.js'
import type { Logger } from 'winston'
import { ListrTaskWrapper, ListrRenderer } from "listr2";
import { Browser } from '@playwright/test';
import snapshotQueue from './lib/processSnapshot.js';

export interface Context {
    env: Env;
    log: Logger;
    task?: ListrTaskWrapper<Context, typeof ListrRenderer, typeof ListrRenderer>;
    server?: FastifyInstance<Server, IncomingMessage, ServerResponse>;
    client: httpClient;
    browser?: Browser;
    snapshotQueue?: snapshotQueue;
    config: {
        web?: WebConfig;
        mobile?: MobileConfig,
        waitForPageRender: number;
        waitForTimeout: number;
        enableJavaScript: boolean;
        clienableJavaScript: boolean;
        allowedHostnames: Array<string>;
    };
    uploadFilePath: string;
    webStaticConfig: WebStaticConfig;
    build: Build;
    git: Git;
    args: {
        execCommand?: Array<string>
    }
    options: {
        parallel?: boolean,
        markBaseline?: boolean,
        buildName?: string,
        port?: number,
        ignoreResolutions?: boolean,
        fileExtension?: Array<string>,
        stripExtension?: boolean,
        ignorePattern?: Array<string>,
    }
    cliVersion: string;
    totalSnapshots: number;
    figmaDesignConfig?: FigmaDesignConfig;
    testType?: string;
}

export interface Env {
    PROJECT_TOKEN: string;
    SMARTUI_CLIENT_API_URL: string;
    LT_SDK_DEBUG: string | undefined;
    SMARTUI_GIT_INFO_FILEPATH: string | undefined;
    HTTP_PROXY: string | undefined;
    HTTPS_PROXY: string | undefined;
    GITHUB_ACTIONS: string | undefined;
    FIGMA_TOKEN: string | undefined;
    LT_USERNAME : string | undefined;
    LT_ACCESS_KEY : string | undefined;
    BASELINE_BRANCH: string | undefined;
    CURRENT_BRANCH: string | undefined;
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
        },
        element?: {
            id?: string,
            class?: string,
            cssSelector?: string,
            xpath?: string
        }
    }
}

export interface ProcessedSnapshot {
    url: string,
    name: string,
    dom: string,
    resources: Record<string, any>,
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
    baselineBranch?: string;
}

export interface Build {
    id: string;
    name: string;
    url: string;
    baseline: boolean;
}

export interface WebConfig {
    browsers: Array<string>;
    viewports: Array<{width: number, height: number}>;
}

export interface MobileConfig {
    devices: Array<string>;
    fullPage?: boolean;
    orientation?: string;
}

export type WebStaticConfig = Array<{
    name: string;
    url: string;
    waitForTimeout?: number
}>;

export type FigmaConfigItem = {
    figma_file_token: string;
    figma_ids: string[];
};

export type FigmaDesignConfig = {
    depth: number;
    figma_config: FigmaConfigItem[];
};
