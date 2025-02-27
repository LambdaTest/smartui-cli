import { Context, Env, WebConfig, MobileConfig, basicAuth } from '../types.js'
import constants from './constants.js'
import { version } from '../../package.json'
import { validateConfig } from './schemaValidation.js'
import logger from './logger.js'
import getEnv from './env.js'
import httpClient from './httpClient.js'
import fs from 'fs'

export default (options: Record<string, string>): Context => {
    let env: Env = getEnv();
    let webConfig: WebConfig;
    let mobileConfig: MobileConfig;
    let basicAuthObj: basicAuth
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
    try {
        if (options.config) {
            config = JSON.parse(fs.readFileSync(options.config, 'utf-8'));

            // resolutions supported for backward compatibility
            if (config.web?.resolutions) {
                config.web.viewports = config.web.resolutions;
                delete config.web.resolutions;
            }

            // validate config
            if (!validateConfig(config)) {
                throw new Error(validateConfig.errors[0].message);
            }
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
            fetchResultsFileObj = options.fetchResults === true ? 'results.json' : options.fetchResults;
        } else {
            fetchResultObj = false
            fetchResultsFileObj = ''
        }
        buildNameObj = options.buildName || ''
    } catch (error: any) {
        console.log(`[smartui] Error: ${error.message}`);
        process.exit();
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
        basicAuthObj = config.basicAuthorization
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
            basicAuthorization: basicAuthObj,
            smartIgnore: config.smartIgnore ?? false,
            delayedUpload: config.delayedUpload ?? false,
<<<<<<< HEAD
            ignoreHTTPSErrors: config.ignoreHTTPSErrors ?? false
=======
            useGlobalCache: config.useGlobalCache ?? false
>>>>>>> upstream/stage
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
        options: {
            parallel: parallelObj,
            force: options.force ? true : false,
            markBaseline: options.markBaseline ? true : false,
            buildName: options.buildName || '',
            port: port,
            ignoreResolutions: resolutionOff,
            fileExtension: extensionFiles,
            stripExtension: ignoreStripExtension,
            ignorePattern: ignoreFilePattern,
            fetchResults: fetchResultObj,
            fetchResultsFileName: fetchResultsFileObj,
        },
        cliVersion: version,
        totalSnapshots: -1,
        isStartExec: false,
        isSnapshotCaptured: false
    }
}