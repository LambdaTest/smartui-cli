import { Server, IncomingMessage, ServerResponse } from 'http'
import { FastifyInstance } from 'fastify'
import httpClient from './lib/httpClient.js'
import type { Logger } from 'winston'
import { ListrTaskWrapper, ListrRenderer } from "listr2";
import { Browser } from '@playwright/test';
import snapshotQueue from './lib/snapshotQueue.js';

export interface Context {
    env: Env;
    log: Logger;
    task?: ListrTaskWrapper<Context, typeof ListrRenderer, typeof ListrRenderer>;
    server?: FastifyInstance<Server, IncomingMessage, ServerResponse>;
    client: httpClient;
    browser?: Browser;
    authenticatedInitially?: boolean;
    snapshotQueue?: snapshotQueue;
    config: {
        web?: WebConfig;
        mobile?: MobileConfig,
        waitForPageRender: number;
        waitForTimeout: number;
        waitForDiscovery: number;
        enableJavaScript: boolean;
        cliEnableJavaScript: boolean;
        scrollTime: number;
        allowedHostnames: Array<string>;
        allowedAssets: Array<string>;
        basicAuthorization: basicAuth | undefined;
        lazyLoadConfiguration: lazyLoadConfig | undefined;
        smartIgnore: boolean;
        delayedUpload: boolean;
        useGlobalCache: boolean;
        figma?: FigmaWebConfig;
        ignoreHTTPSErrors : boolean;
        skipBuildCreation?: boolean;
        tunnel: tunnelConfig | undefined;
        dedicatedProxyURL?: string;
        geolocation?: string;
        userAgent?: string;
        requestHeaders?: Array<Record<string, string>>;
        allowDuplicateSnapshotNames?: boolean;
        useLambdaInternal?: boolean;
        useRemoteDiscovery?: boolean;
        useExtendedViewport?: boolean;
        loadDomContent?: boolean;
        approvalThreshold?: number;
        rejectionThreshold?: number;
        showRenderErrors?: boolean;
        customCSS?: string;
        storybook?: StorybookConfig;
    };
    uploadFilePath: string;
    webStaticConfig: WebStaticConfig;
    build: Build;
    git: Git;
    storybook?: {
        mode?: 'url' | 'dir';
        // URL mode: map of storyId -> { name, kind, url(iframe) }
        stories?: Record<string, StorybookStory>;
        // DIR mode: enumerated storyIds to render server-side
        storyIds?: Array<string>;
    };
    args: {
        execCommand?: Array<string>;
        storybookTarget?: string;
    }
    tunnelDetails: {
        tunnelPort: number;
        tunnelHost: string;
        tunnelName: string;
    }
    geolocationData?: {
        proxy: string;
        username: string;
        password: string;
        geoCode: string;
    }
    options: {
        parallel?: number,
        force?: boolean,
        markBaseline?: boolean,
        buildName?: string,
        scheduled?: string,
        port?: number,
        ignoreResolutions?: boolean,
        fileExtension?: Array<string>,
        stripExtension?: boolean,
        ignorePattern?: Array<string>,
        fetchResults?: boolean,
        fetchResultsFileName?: string,
        baselineBranch?: string,
        baselineBuild?: string,
        githubURL?: string,
        gitURL?: string,
        showRenderErrors?: boolean,
        pdfNames?: string,
        userName?: string,
        accessKey?: string
    }
    cliVersion: string;
    totalSnapshots: number;
    figmaDesignConfig?: FigmaDesignConfig;
    testType?: string;
    isStartExec ?: boolean;
    isSnapshotCaptured ?: boolean;
    sessionCapabilitiesMap?: Map<string, any[]>;
    sessionTestIdMap?: Map<string, string>;
    testIdTestNameMap?: Map<string, string>;
    buildToSnapshotCountMap?: Map<string, number>;
    fetchResultsForBuild?: Array<string>;
    sessionIdToSnapshotNameMap?: Map<string, string[]>;
    orgId?: number;
    userId?: number;
    mergeBranchSource?: string;
    mergeBranchTarget?: string;
    mergeBuildSource?: string;
    mergeBuildTarget?: string;
    mergeBuildSourceId?: string;
    mergeBuildTargetId?: string;
    mergeByBranch?: boolean;
    mergeByBuild?: boolean;
    contextToSnapshotMap?: Map<string, string>;
    sourceCommand?: string;
    autoTunnelStarted?: boolean;
    logFileUUID?: string;
    logFilePath?: string;
}

export interface Env {
    PROJECT_TOKEN: string;
    SMARTUI_CLIENT_API_URL: string;
    SMARTUI_UPLOAD_URL: string;
    SMARTUI_DO_NOT_USE_CAPTURED_COOKIES: boolean;
    SMARTUI_GIT_INFO_FILEPATH: string | undefined;
    HTTP_PROXY: string | undefined;
    HTTPS_PROXY: string | undefined;
    SMARTUI_HTTP_PROXY: string | undefined;
    SMARTUI_HTTPS_PROXY: string | undefined;
    GIT_URL: string | undefined;
    BASIC_AUTH_USERNAME: string | undefined;
    BASIC_AUTH_PASSWORD: string | undefined;
    FIGMA_TOKEN: string | undefined;
    LT_USERNAME : string | undefined;
    LT_ACCESS_KEY : string | undefined;
    LT_SDK_DEBUG: boolean;
    LT_SDK_DEBUG_SMARTUI_CLI: boolean;
    BASELINE_BRANCH: string | undefined;
    CURRENT_BRANCH: string | undefined;
    PROJECT_NAME: string | undefined;
    SMARTUI_API_PROXY: string | undefined;
    SMARTUI_API_SKIP_CERTIFICATES: boolean;
    USE_REMOTE_DISCOVERY: boolean;
    SMART_GIT: boolean;
    SHOW_RENDER_ERRORS: boolean;
    SMARTUI_SSE_URL: string;
    LT_SDK_SKIP_EXECUTION_LOGS: boolean;
    SMARTUI_PRESERVE_EXEC_LOGS_COLOR: boolean;
    MAX_CONCURRENT_PROCESSING: number;
    DO_NOT_USE_USER_AGENT: boolean;
    CAPTURE_RENDERING_ERRORS: boolean;
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
            xpath?: Array<string>,
            coordinates?: Array<string>
        },
        selectDOM?: {
            id?: Array<string>,
            class?: Array<string>,
            cssSelector?: Array<string>,
            xpath?: Array<string>,
            coordinates?: Array<string>
        },
        ignoreColors?: {
            id?: Array<string>,
            class?: Array<string>,
            cssSelector?: Array<string>,
            xpath?: Array<string>,
            coordinates?: Array<string>,
            entireScreenshot?: boolean
        },
        element?: {
            id?: string,
            class?: string,
            cssSelector?: string,
            xpath?: string
        },
        web?: {
            browsers?: string[],
            viewports: ([number] | [number, number])[],
            customViewports?: Array<{ browser: string, viewport: [number] | [number, number] }>
        },
        mobile?: {
            devices: string[],
            fullPage?: boolean,
            orientation?: string
        },
        loadDomContent?: boolean;
        ignoreType?: string[],
        sessionId?: string
        testId?: string
        testName?: string
        sync?: boolean;
        contextId?: string;
        useExtendedViewport?: boolean;
        pageCustomScroll?: boolean;
        elementsCustomScroll?: boolean;
        approvalThreshold?: number;
        rejectionThreshold?: number;
        customCookies?: CustomCookie[];
        customCSS?: string;
    }
}

export interface ProcessedSnapshot {
    url: string,
    name: string,
    dom: string,
    resources: Record<string, any>,
    options: {
        ignoreBoxes?: Record<string, Array<Record<string, number | string>>>,
        selectBoxes?: Record<string, Array<Record<string, number | string>>>
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
    useKafkaFlow: boolean;
    hasDiscoveryError: boolean;
    projectId?: string;
    checkPendingRequests: boolean;
}

export interface CustomViewportEntry {
    browser: string;
    viewport: { width: number, height?: number };
}

export interface WebConfig {
    browsers: Array<string>;
    viewports: Array<{ width: number, height: number }>;
    browserViewports?: Record<string, Array<{ width: number, height: number }>>;
}

export interface MobileConfig {
    devices: Array<string>;
    fullPage?: boolean;
    orientation?: string;
}

export type WebStaticConfig = Array<{
    name: string;
    url: string;
    waitForTimeout?: number;
    userAgent?: string;
}>;

export type FigmaConfigItem = {
    figma_file_token: string;
    figma_ids: string[];
};

export type FigmaDesignConfig = {
    depth: number;
    figma_config: FigmaConfigItem[];
};

export interface basicAuth {
    username: string;
    password: string;
}

export interface lazyLoadConfig {
    enabled: boolean;
    scrollStep: number;
    scrollDelay: number;
    maxScrolls: number;
    jumpBackToTop: boolean;
}

export interface tunnelConfig {
    type: string;
    tunnelName: string;
    user: string;
    key: string;
    port: number;
    proxyHost: string;
    proxyPort: number;
    proxyUser: string;
    proxyPass: string;
    dir: string;
    v: boolean;
    logFile: string;
    environment:string;
}

export interface StorybookStory {
    name: string;
    kind?: string;
    url: string;
}

export interface StorybookCustomViewport {
    stories?: Array<string>;
    exclude?: Array<string>;
    styles?: { width: number, height?: number };
    waitForTimeout?: number;
}

export interface StorybookConfig {
    browsers?: Array<string>;
    // [ [w] | [w,h] ] pairs; resolutions takes precedence over viewports
    viewports?: Array<[number] | [number, number]>;
    resolutions?: Array<[number] | [number, number]>;
    waitForTimeout?: number;
    include?: Array<string>;
    exclude?: Array<string>;
    customViewports?: Array<StorybookCustomViewport>;
    useOnlyCustomViewports?: boolean;
    backgroundTheme?: 'light' | 'dark' | 'both';
    useGlobals?: boolean;
    lazyLoadedStories?: Array<string>;
    chunkSize?: number;
}

export interface FigmaWebConfig {
    autoDetectViewports: Array<string>;
    configs: Array<{ figma_file_token: string, figma_ids: Array<string>, screenshot_names:Array<string> }>;
}

export interface CustomCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
}


export interface ViewportErrors {
    statusCode: "aborted" | "404" | string;
    url: string;
    resourceType: string;
  }
  
export interface DiscoveryErrors {
    name: string;
    url: string;
    timestamp: string;
    snapshotUUID: string;
    browsers: {
      [browserName: string]: {
        [viewport: string]: ViewportErrors[];
      };
    };
  }