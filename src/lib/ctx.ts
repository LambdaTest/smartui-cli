import { Context, Env, WebConfig, MobileConfig, basicAuth, tunnelConfig } from '../types.js'
import constants from './constants.js'
import { version } from '../../package.json'
import { validateConfig, validateConfigForScheduled } from './schemaValidation.js'
import logger from './logger.js'
import getEnv from './env.js'
import httpClient from './httpClient.js'
import fs from 'fs'

export default (options: Record<string, string>): Context => {
    let env: Env = getEnv();
    let webConfig: WebConfig;
    let mobileConfig: MobileConfig;
    let basicAuthObj: basicAuth
    let tunnelObj: tunnelConfig
    let config = constants.DEFAULT_CONFIG;
    let port: number;
    let resolutionOff: boolean;
    let extensionFiles: string;
    let ignoreStripExtension: Array<string>;
    let ignoreFilePattern: Array<string>;
    let parallelObj: number;
    let fetchResultObj: boolean;
    let fetchResultsFileObj: string;
    let buildNameObj: string;
    let allowDuplicateSnapshotNames: boolean = false;
    let useLambdaInternal: boolean = false;
    let useExtendedViewport: boolean = false;
    let loadDomContent: boolean = false;
    try {
        if (options.config) {
            config = JSON.parse(fs.readFileSync(options.config, 'utf-8'));
            // TODO: Mask sensitive data of config file
            // logger.debug(`Config file ${options.config} loaded: ${JSON.stringify(config, null, 2)}`);

            // resolutions supported for backward compatibility
            if (config.web?.resolutions) {
                config.web.viewports = config.web.resolutions;
                delete config.web.resolutions;
            }

            if(config.approvalThreshold && config.rejectionThreshold) {
                if(config.rejectionThreshold <= config.approvalThreshold) {
                    throw new Error('Invalid config; rejectionThreshold must be greater than approvalThreshold');
                }
            }

            let validateConfigFn = options.scheduled ? validateConfigForScheduled : validateConfig;

            // validate config
            if (!validateConfigFn(config)) {
                throw new Error(validateConfigFn.errors[0].message);
            }
        } else {
            logger.info("## No config file provided. Using default config.");
        }
        port = parseInt(options.port || '49152', 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error('Invalid port number. Port number must be an integer between 1 and 65535.');
        }
        resolutionOff = options.ignoreResolutions || false;
        extensionFiles = options.files || ['png', 'jpeg', 'jpg'];
        ignoreStripExtension = options.removeExtensions || false
        ignoreFilePattern = options.ignoreDir || []

        parallelObj = options.parallel ? options.parallel === true? 1 : options.parallel: 1;
        if (options.fetchResults) {
            if (options.fetchResults !== true && !options.fetchResults.endsWith('.json')) {
                console.error("Error: The file extension for --fetch-results must be .json");
                process.exit(1);
            }
            fetchResultObj = true
            fetchResultsFileObj = options.fetchResults === true ? '' : options.fetchResults;
        } else {
            fetchResultObj = false
            fetchResultsFileObj = ''
        }
        buildNameObj = options.buildName || ''
        if (options.userName && options.accessKey) {
            env.LT_USERNAME = options.userName
            env.LT_ACCESS_KEY = options.accessKey
        }
    } catch (error: any) {
        console.log(`[smartui] Error: ${error.message}`);
        process.exit(1);
    }

    if (config.web) {
        webConfig = { browsers: config.web.browsers, viewports: [] };
        for (let viewport of config.web?.viewports) webConfig.viewports.push({ width: viewport[0], height: viewport[1] || 0 });
    }
    if (config.mobile) {
        mobileConfig = {
            devices: config.mobile.devices,
            fullPage: config.mobile.fullPage ?? true,
            orientation: config.mobile.orientation || constants.MOBILE_ORIENTATION_PORTRAIT,
        }
    }
    if (config.basicAuthorization) {
        basicAuthObj = config.basicAuthorization;
    }
    if (config.tunnel) {
        tunnelObj = config.tunnel;
    }
    if (config.allowDuplicateSnapshotNames) {
        allowDuplicateSnapshotNames = true;
    }
    if (config.useLambdaInternal) {
        useLambdaInternal = true;
    }
    if (config.useExtendedViewport) {
        useExtendedViewport = true;
    }
    if (config.loadDomContent) {
        loadDomContent = true;
    }

    //if config.waitForPageRender has value and if its less than 30000 then make it to 30000 default
    if (config.waitForPageRender && config.waitForPageRender < 30000) {
        config.waitForPageRender = 30000;
    }

    return {
        env: env,
        log: logger,
        client: new httpClient(env),
        config: {
            web: webConfig,
            mobile: mobileConfig,
            waitForPageRender: config.waitForPageRender || 0,
            waitForTimeout: config.waitForTimeout || 0,
            waitForDiscovery: config.waitForDiscovery || 30000,
            enableJavaScript: config.enableJavaScript ?? false,
            cliEnableJavaScript: config.cliEnableJavaScript ?? true,
            scrollTime: config.scrollTime || constants.DEFAULT_SCROLL_TIME,
            allowedHostnames: config.allowedHostnames || [],
            allowedAssets: config.allowedAssets || [],
            basicAuthorization: basicAuthObj,
            smartIgnore: config.smartIgnore ?? false,
            delayedUpload: config.delayedUpload ?? false,
            useGlobalCache: config.useGlobalCache ?? false,
            ignoreHTTPSErrors: config.ignoreHTTPSErrors ?? false,
            skipBuildCreation: config.skipBuildCreation ?? false,
            tunnel: tunnelObj,
            userAgent: config.userAgent || '',
            requestHeaders: config.requestHeaders || {},
            allowDuplicateSnapshotNames: allowDuplicateSnapshotNames,
            useLambdaInternal: useLambdaInternal,
            useExtendedViewport: useExtendedViewport,
            loadDomContent: loadDomContent,
            approvalThreshold: config.approvalThreshold,
            rejectionThreshold: config.rejectionThreshold,
        },
        uploadFilePath: '',
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
            name: buildNameObj,
            baseline: false,
            url: ''
        },
        args: {},
        tunnelDetails: {
            tunnelPort: -1,
            tunnelHost: '',
            tunnelName: ''
        },
        options: {
            parallel: parallelObj,
            force: options.force ? true : false,
            markBaseline: options.markBaseline ? true : false,
            buildName: options.buildName || '',
            scheduled: options.scheduled || '',
            port: port,
            ignoreResolutions: resolutionOff,
            fileExtension: extensionFiles,
            stripExtension: ignoreStripExtension,
            ignorePattern: ignoreFilePattern,
            fetchResults: fetchResultObj,
            fetchResultsFileName: fetchResultsFileObj,
            baselineBranch: options.baselineBranch || '',
            baselineBuild: options.baselineBuild || '',
            githubURL : options.githubURL || ''
        },
        cliVersion: version,
        totalSnapshots: -1,
        isStartExec: false,
        isSnapshotCaptured: false,
        sessionCapabilitiesMap: new Map<string, any[]>(),
        buildToSnapshotCountMap: new Map<string, number>(),
        fetchResultsForBuild: new Array<string>,
        orgId: 0,
        userId: 0,
        mergeBranchSource: '',
        mergeBranchTarget: '',
        mergeBuildSource: '',
        mergeBuildTarget: '',
        mergeBuildSourceId: '',
        mergeBuildTargetId: '',
        mergeByBranch: false,
        mergeByBuild: false
    }
}