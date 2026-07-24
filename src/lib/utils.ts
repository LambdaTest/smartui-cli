import { Context } from '../types.js'
import { chromium, firefox, webkit, Browser } from '@playwright/test'
import constants from './constants.js';
import chalk from 'chalk';
import axios from 'axios';
import fs from 'fs';
import { globalAgent } from 'http';
import { promisify } from 'util'
import { build } from 'tsup';
import postcss from 'postcss';
const util = require('util'); // Import the util module

var lambdaTunnel = require('@lambdatest/node-tunnel');
const sleep = promisify(setTimeout);

// let isPollingActive = false;
let globalContext: Context;

let tunnelInstance;
export const setGlobalContext = (newContext: Context): void => {
    globalContext = newContext;
};

export function delDir(dir: string): void {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
    }
}

export function scrollToBottomAndBackToTop({
    frequency = 100,
    timing = 8,
    remoteWindow = window
} = {}): Promise<void> {
    return new Promise(resolve => {
        let scrolls = 1;
        let scrollLength = remoteWindow.document.body.scrollHeight / frequency;

        (function scroll() {
            let scrollBy = scrollLength * scrolls;

            remoteWindow.setTimeout(() => {
                remoteWindow.scrollTo(0, scrollBy);

                if (scrolls < frequency) {
                    scrolls += 1;
                    scroll();
                }

                if (scrolls === frequency) {
                    remoteWindow.setTimeout(() => {
                        remoteWindow.scrollTo(0, 0)
                        resolve();
                    }, timing);
                }
            }, timing);
        })();
    });
}

export function smoothScrollToBottom({
  step = 250,
  delay = 300,
  maxScrolls = 50,
  jumpBackToTop = true
} = {}): Promise<void> {
  return new Promise((resolve) => {
    let totalHeight = document.body.scrollHeight;
    let currentScroll = window.scrollY;
    let scrollCount = 0;

    function scroll() {
      if (currentScroll + window.innerHeight >= totalHeight || scrollCount >= maxScrolls) {
        if (jumpBackToTop) {
          window.scrollTo(0, 0);
        }
        resolve();
        return;
      }

      window.scrollBy(0, step);
      scrollCount++;

      setTimeout(() => {
        currentScroll = window.scrollY;
        totalHeight = document.body.scrollHeight;
        scroll();
      }, delay);
    }

    scroll();
  });
}

export async function launchBrowsers(ctx: Context): Promise<Record<string, Browser>> {
    let browsers: Record<string, Browser> = {};
    const isHeadless = process.env.HEADLESS?.toLowerCase() === 'false' ? false : true;
    let launchOptions: Record<string, any> = { headless: isHeadless };

    const proxyServer = ctx.env.SMARTUI_HTTPS_PROXY || ctx.env.SMARTUI_HTTP_PROXY || ctx.env.HTTPS_PROXY || ctx.env.HTTP_PROXY;
    if (proxyServer) {
        launchOptions.proxy = { server: proxyServer };
    }

    // constants.LAUNCH_ARGS are Chromium (Blink) CLI flags; WebKit/Firefox — notably the Linux
    // Playwright builds — reject unknown options and fail to launch. Scope the args to Chromium only.
    const chromiumLaunchOptions: Record<string, any> = { ...launchOptions, args: constants.LAUNCH_ARGS };

    if (ctx.config.web) {
        for (const browser of ctx.config.web.browsers) {
            switch (browser) {
                case constants.CHROME:
                    browsers[constants.CHROME] = await chromium.launch(chromiumLaunchOptions);
                    break;
                case constants.SAFARI:
                    browsers[constants.SAFARI] = await webkit.launch(launchOptions);
                    break;
                case constants.FIREFOX:
                    browsers[constants.FIREFOX] = await firefox.launch(launchOptions);
                    break;
                case constants.EDGE:
                    browsers[constants.EDGE] = await chromium.launch({ channel: constants.EDGE_CHANNEL, ...launchOptions, args: [...constants.LAUNCH_ARGS, '--headless=new'] });
                    break;
            }
        }
    }
    if (ctx.config.mobile) {
        for (const device of ctx.config.mobile.devices) {
            if (constants.SUPPORTED_MOBILE_DEVICES[device].os === 'android' && !browsers[constants.CHROME]) browsers[constants.CHROME] = await chromium.launch(chromiumLaunchOptions);
            else if (constants.SUPPORTED_MOBILE_DEVICES[device].os === 'ios' && !browsers[constants.SAFARI]) browsers[constants.SAFARI] = await webkit.launch(launchOptions);
        }
    }

    return browsers;
}

export async function closeBrowsers(browsers: Record<string, Browser>): Promise<void> {
    for (const browserName of Object.keys(browsers)) await browsers[browserName]?.close();
}

export function getWebRenderViewports(ctx: Context): Array<Record<string, any>> {
    let webRenderViewports: Array<Record<string, any>> = [];

    if (ctx.config.web) {
        if (ctx.config.web.browserViewports) {
            const seen = new Set<string>();
            for (const viewports of Object.values(ctx.config.web.browserViewports)) {
                for (const viewport of viewports as Array<{ width: number, height: number }>) {
                    const key = `${viewport.width}x${viewport.height}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        webRenderViewports.push({
                            viewport,
                            viewportString: `${viewport.width}${viewport.height ? 'x' + viewport.height : ''}`,
                            fullPage: viewport.height ? false : true,
                            device: false
                        });
                    }
                }
            }
        } else {
            for (const viewport of ctx.config.web.viewports) {
                webRenderViewports.push({
                    viewport,
                    viewportString: `${viewport.width}${viewport.height ? 'x'+viewport.height : ''}`,
                    fullPage: viewport.height ? false : true,
                    device: false
                })
            }
        }
    }

    return webRenderViewports
}

export function getWebRenderViewportsForOptions(options: any): Array<Record<string, any>> {
    let webRenderViewports: Array<Record<string, any>> = [];

    if (options.web && Array.isArray(options.web.customViewports) && options.web.customViewports.length > 0) {
        const browserViewports = transformCustomViewportsToBrowserViewports(options.web.customViewports);
        const seen = new Set<string>();
        for (const viewports of Object.values(browserViewports)) {
            for (const vp of viewports as Array<{ width: number, height: number }>) {
                const key = `${vp.width}x${vp.height}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    webRenderViewports.push({
                        viewport: vp,
                        viewportString: `${vp.width}${vp.height ? 'x' + vp.height : ''}`,
                        fullPage: vp.height ? false : true,
                        device: false
                    });
                }
            }
        }
    } else if (options.web && Array.isArray(options.web.viewports)) {
        for (const viewport of options.web.viewports) {
            if (Array.isArray(viewport) && viewport.length > 0) {
                let viewportObj: { width: number; height?: number } = {
                    width: viewport[0]
                };

                if (viewport.length > 1) {
                    viewportObj.height = viewport[1];
                }

                webRenderViewports.push({
                    viewport: viewportObj,
                    viewportString: `${viewport[0]}${viewport[1] ? 'x'+viewport[1] : ''}`,
                    fullPage: viewport.length === 1,
                    device: false
                });
            }
        }
    }

    return webRenderViewports;
}

export function transformCustomViewportsToBrowserViewports(
    customViewports: Array<{ browser: string, viewport: [number] | [number, number] }>
): Record<string, Array<{ width: number, height: number }>> {
    const browserViewports: Record<string, Array<{ width: number, height: number }>> = {};
    for (const entry of customViewports) {
        if (!browserViewports[entry.browser]) {
            browserViewports[entry.browser] = [];
        }
        const vp = { width: entry.viewport[0], height: entry.viewport[1] || 0 };
        const exists = browserViewports[entry.browser].some(
            existing => existing.width === vp.width && existing.height === vp.height
        );
        if (!exists) {
            browserViewports[entry.browser].push(vp);
        }
    }
    return browserViewports;
}

export function getMobileRenderViewports(ctx: Context): Record<string, any> {
    let mobileRenderViewports: Record<string, Array<Record<string, any>>> = {}
    mobileRenderViewports[constants.MOBILE_OS_IOS] = [];
    mobileRenderViewports[constants.MOBILE_OS_ANDROID] = [];

    if (ctx.config.mobile) {
        for (const device of ctx.config.mobile.devices) {
            let os = constants.SUPPORTED_MOBILE_DEVICES[device].os;
            let { width, height } = constants.SUPPORTED_MOBILE_DEVICES[device].viewport;
            let portrait = (ctx.config.mobile.orientation === constants.MOBILE_ORIENTATION_PORTRAIT) ? true : false;

            mobileRenderViewports[os]?.push({
                viewport: { width: portrait ? width : height, height: portrait ? height : width },
                viewportString: `${device} (${ctx.config.mobile.orientation})`,
                fullPage: ctx.config.mobile.fullPage,
                device: true,
                os: os
            })
        }
    }

    return mobileRenderViewports
}

export function getMobileRenderViewportsForOptions(options: any): Record<string, any> {
    let mobileRenderViewports: Record<string, Array<Record<string, any>>> = {}
    mobileRenderViewports[constants.MOBILE_OS_IOS] = [];
    mobileRenderViewports[constants.MOBILE_OS_ANDROID] = [];

    if (options.mobile) {
        for (const device of options.mobile.devices) {
            let os = constants.SUPPORTED_MOBILE_DEVICES[device].os;
            let { width, height } = constants.SUPPORTED_MOBILE_DEVICES[device].viewport;
            let orientation = options.mobile.orientation || constants.MOBILE_ORIENTATION_PORTRAIT;
            let portrait = (orientation === constants.MOBILE_ORIENTATION_PORTRAIT);

            // Check if fullPage is specified, otherwise use default
            let fullPage
            if (options.mobile.fullPage === undefined || options.mobile.fullPage) {
                fullPage = true
            } else {
                fullPage = false
            }

            mobileRenderViewports[os]?.push({
                viewport: { width: portrait ? width : height, height: portrait ? height : width },
                viewportString: `${device} (${orientation})`,
                fullPage: fullPage,
                device: true,
                os: os
            })
        }
    }

    return mobileRenderViewports
}

export function getRenderViewports(ctx: Context): Array<Record<string, any>> {
    let mobileRenderViewports = getMobileRenderViewports(ctx);
    let webRenderViewports = getWebRenderViewports(ctx);

    // Combine arrays ensuring web viewports are first
    return [
        ...webRenderViewports,
        ...mobileRenderViewports[constants.MOBILE_OS_IOS],
        ...mobileRenderViewports[constants.MOBILE_OS_ANDROID]
    ];
}

export function getRenderViewportsForOptions(options: any): Array<Record<string, any>> {
    let mobileRenderViewports = getMobileRenderViewportsForOptions(options);
    let webRenderViewports = getWebRenderViewportsForOptions(options);

    // Combine arrays ensuring web viewports are first
    return [
        ...webRenderViewports,
        ...mobileRenderViewports[constants.MOBILE_OS_IOS],
        ...mobileRenderViewports[constants.MOBILE_OS_ANDROID]
    ];
}

// Global SIGINT handler
// process.on('SIGINT', async () => {
//     if (isPollingActive) {
//         console.log('Fetching results interrupted. Exiting...');
//         isPollingActive = false;
//     } else {
//         console.log('\nExiting gracefully...');
//     }
//     process.exit(0);
// });

// Background polling function
export async function startPolling(ctx: Context, build_id: string, baseline: boolean, projectToken: string): Promise<void> {
    let isPollingActive = true;
    if (build_id) {
        ctx.log.info(`Fetching results for buildId ${build_id} in progress....`);
    } else if (ctx.build && ctx.build.id) {
        ctx.log.info(`Fetching results for buildId ${ctx.build.id} in progress....`);
    }

    const intervalId = setInterval(async () => {
        if (!isPollingActive) {
            clearInterval(intervalId);
            return;
        }

        try {
            let resp;
            if (build_id) {
                resp = await ctx.client.getScreenshotData(build_id, baseline, ctx.log, projectToken, '');
            } else if (ctx.build && ctx.build.id) {
                resp = await ctx.client.getScreenshotData(ctx.build.id, ctx.build.baseline, ctx.log, '', '');
            } else {
                return;
            }

            if (!resp.build) {
                ctx.log.info("Error: Build data is null.");
                clearInterval(intervalId);
                return;
            }

            let fileName = `${resp.build.build_id}.json`
            if (ctx.options.fetchResults && ctx.options.fetchResultsFileName && ctx.build && ctx.build.id && resp.build.build_id === ctx.build.id) {
                fileName = `${ctx.options.fetchResultsFileName}`
            }
            let output: any = resp;
            if (resp.build.build_type === constants.BUILD_TYPE_OMNI) {
                const pdfScreenshotsGroup = buildPdfScreenshotsGroup(resp.screenshots || {});
                const { normalScreenshots: filteredScreenshots } = separateScreenshots(resp.screenshots || {});
                output = { ...resp, screenshots: filteredScreenshots, pdfScreenshots: pdfScreenshotsGroup };
            }
            fs.writeFileSync(`${fileName}`, JSON.stringify(output, null, 2));
            ctx.log.debug(`Updated results in ${fileName}`);

            if (resp.build.build_status_ind === constants.BUILD_COMPLETE || resp.build.build_status_ind === constants.BUILD_ERROR) {
                clearInterval(intervalId);
                ctx.log.info(`Fetching results completed. Final results written to ${fileName}`);

                if (resp.build.build_type === constants.BUILD_TYPE_OMNI) {
                    // Omni build: separate PDFs from normal screenshots and display both
                    const { normalScreenshots, pdfScreenshots } = separateScreenshots(resp.screenshots || {});

                    printOmniHeader(resp.build, resp.project);

                    let pdfGroups: Record<string, any[]> = {};
                    if (pdfScreenshots.length > 0) {
                        const pdfResult = printPdfSection(pdfScreenshots);
                        pdfGroups = pdfResult.pdfGroups;
                    }

                    if (Object.keys(normalScreenshots).length > 0) {
                        printScreenshotSection(normalScreenshots);
                    }

                    const buildResult = resp.build.build_status?.toLowerCase() === 'approved' ? 'Passed' : 'Failed';
                    const resultColor = buildResult === 'Passed' ? chalk.green : chalk.red;

                    // Write formatted omni results
                    const formattedResults = {
                        status: 'success',
                        data: {
                            buildId: resp.build.build_id,
                            buildName: resp.build.build_name,
                            projectName: resp.project.name,
                            buildStatus: resp.build.build_status,
                            buildResult,
                            branchName: resp.build.branch,
                            pdfs: formatPdfsForOutput(pdfGroups),
                            screenshots: formatScreenshotsForOutput(normalScreenshots)
                        }
                    };

                    if (ctx.options.fetchResults && ctx.options.fetchResultsFileName) {
                        const omniFileName = ctx.options.fetchResultsFileName !== '' ? ctx.options.fetchResultsFileName : 'results.json';
                        fs.writeFileSync(omniFileName, JSON.stringify(formattedResults, null, 2));
                        console.log(chalk.green(`\nResults saved to ${omniFileName}`));
                    }
                    console.log(resultColor.bold(`\nResult of Build ${resp.build.build_name} : ${buildResult}`));
                } else {
                    // Non-omni build: existing behavior
                    let totalScreenshotsWithMismatches = 0;
                    let totalVariantsWithMismatches = 0;
                    const totalScreenshots = Object.keys(resp.screenshots || {}).length;
                    let totalVariants = 0;

                    for (const [screenshot, variants] of Object.entries(resp.screenshots || {})) {
                        let screenshotHasMismatch = false;
                        let variantMismatchCount = 0;

                        totalVariants += (variants as any[]).length;

                        for (const variant of (variants as any[])) {
                            if (variant.mismatch_percentage > 0) {
                                screenshotHasMismatch = true;
                                variantMismatchCount++;
                            }
                        }

                        if (screenshotHasMismatch) {
                            totalScreenshotsWithMismatches++;
                            totalVariantsWithMismatches += variantMismatchCount;
                        }
                    }

                    // Display summary
                    ctx.log.info(
                        chalk.green.bold(
                            `\nSummary of Mismatches for buildId: ${build_id}\n` +
                            `${chalk.yellow('Total Variants with Mismatches:')} ${chalk.white(totalVariantsWithMismatches)} out of ${chalk.white(totalVariants)}\n` +
                            `${chalk.yellow('Total Screenshots with Mismatches:')} ${chalk.white(totalScreenshotsWithMismatches)} out of ${chalk.white(totalScreenshots)}\n` +
                            `${chalk.yellow('Branch Name:')} ${chalk.white(resp.build.branch)}\n` +
                            `${chalk.yellow('Project Name:')} ${chalk.white(resp.project.name)}\n` +
                            `${chalk.yellow('Build ID:')} ${chalk.white(resp.build.build_id)}\n`
                        )
                    );
                }
            }
        } catch (error: any) {
            if (error.message.includes('ENOTFOUND')) {
                ctx.log.error('Error: Network error occurred while fetching build results. Please check your connection and try again.');
                clearInterval(intervalId);
            } else {
                ctx.log.error(`Error fetching screenshot data: ${error.message}`);
            }
            clearInterval(intervalId);
        }
    }, 5000);
}

export let pingIntervalId: NodeJS.Timeout | null = null;

export async function startPingPolling(ctx: Context): Promise<void> {
    try {
        ctx.log.debug('Sending initial ping to server...');
        await ctx.client.ping(ctx.build.id, ctx.log);
        ctx.log.debug('Initial ping sent successfully.');
    } catch (error: any) {
        ctx.log.error(`Error during initial ping: ${error.message}`);
    }

    let sourceCommand = ctx.sourceCommand? ctx.sourceCommand : '';
    // Start the polling interval
    pingIntervalId = setInterval(async () => {
        try {
            ctx.log.debug('Sending ping to server... '+ sourceCommand);
            await ctx.client.ping(ctx.build.id, ctx.log);
            ctx.log.debug('Ping sent successfully. '+ sourceCommand);
        } catch (error: any) {
            ctx.log.error(`Error during ping polling: ${error.message}`);
        }
    }, 10 * 60 * 1000); // 10 minutes interval
}

export async function startTunnelBinary(ctx: Context) {
    let tunnelConfig = ctx.config.tunnel
    let tunnelArguments = {
        user: tunnelConfig.user || ctx.env.LT_USERNAME || '',
        key: tunnelConfig.key || ctx.env.LT_ACCESS_KEY || ''
    };

    ctx.config.tunnel.user = tunnelConfig?.user || ctx.env.LT_USERNAME || ''
    ctx.config.tunnel.key = tunnelConfig?.key || ctx.env.LT_ACCESS_KEY || ''

    if (tunnelConfig.port) {
        tunnelArguments.port = tunnelConfig.port;
    }
    if (tunnelConfig?.proxyHost) {
        tunnelArguments.proxyHost = tunnelConfig.proxyHost
    }
    if (tunnelConfig?.proxyPort) {
        tunnelArguments.proxyPort = tunnelConfig.proxyPort
    }
    if (tunnelConfig?.proxyUser) {
        tunnelArguments.proxyUser = tunnelConfig.proxyUser
    }
    if (tunnelConfig?.proxyPass) {
        tunnelArguments.proxyPass = tunnelConfig.proxyPass
    }
    if (tunnelConfig?.dir) {
        tunnelArguments.dir = tunnelConfig.dir
    }
    if (tunnelConfig?.v) {
        tunnelArguments.v = tunnelConfig.v
        tunnelArguments.logLevel = 'debug'
    }
    if (tunnelConfig?.logFile) {
        tunnelArguments.logFile = tunnelConfig.logFile
    }

    if (tunnelConfig?.tunnelName) {
        tunnelArguments.tunnelName = tunnelConfig.tunnelName
    } else {
        const randomNumber = Math.floor(1000000 + Math.random() * 9000000);
        let randomTunnelName = `smartui-cli-Node-tunnel-${randomNumber}`
        tunnelArguments.tunnelName = randomTunnelName;
        ctx.config.tunnel.tunnelName = randomTunnelName
    }
    
    if (tunnelConfig?.environment) {
        tunnelArguments.environment = tunnelConfig.environment
    }


    ctx.log.debug(`tunnel config ${JSON.stringify(tunnelArguments)}`)

    if (ctx.config.tunnel?.type === 'auto') {
        tunnelInstance = new lambdaTunnel();
        const istunnelStarted = await tunnelInstance.start(tunnelArguments);
        ctx.log.debug('Tunnel is started Successfully with status ' + istunnelStarted);
        const tunnelRunningStatus = await tunnelInstance.isRunning();
        ctx.log.debug('Running status of tunnel after start ? ' + tunnelRunningStatus);
    }
}

export let isTunnelPolling: NodeJS.Timeout | null = null;

export async function startPollingForTunnel(ctx: Context, build_id: string, baseline: boolean, projectToken: string, buildName: string): Promise<void> {
    if (isTunnelPolling) {
        ctx.log.debug('Tunnel polling is already active. Skipping for build_id: ' + build_id);
        return;
    }
    const intervalId = setInterval(async () => {
        try {
            let resp;
            if (build_id) {
                resp = await ctx.client.getScreenshotData(build_id, baseline, ctx.log, projectToken, buildName);
            } else if (ctx.build && ctx.build.id) {
                resp = await ctx.client.getScreenshotData(ctx.build.id, ctx.build.baseline, ctx.log, '', '');
            } else {
                ctx.log.debug('No build information available for polling tunnel status.');
                clearInterval(intervalId);
                await stopTunnelHelper(ctx);
                return;
            }
            ctx.log.debug(' resp from polling for tunnel status: ' + JSON.stringify(resp)); 
            if (!resp.build) {
                ctx.log.info("Error: Build data is null.");
                clearInterval(intervalId);
                await stopTunnelHelper(ctx);
                return;
            }

            if (resp.build.build_status_ind === constants.BUILD_COMPLETE || resp.build.build_status_ind === constants.BUILD_ERROR) {
                clearInterval(intervalId);
                await stopTunnelHelper(ctx);
                return;
            }
        } catch (error: any) {
            if (error?.message.includes('ENOTFOUND')) {
                ctx.log.error('Error: Network error occurred while fetching build status while polling. Please check your connection and try again.');
                clearInterval(intervalId);
            } else {
                // Log the error in a human-readable format
                ctx.log.debug(util.inspect(error, { showHidden: false, depth: null }));
                ctx.log.error(`Error fetching build status while polling: ${JSON.stringify(error)}`);
            }
            clearInterval(intervalId);
        }
    }, 5000);
    isTunnelPolling = intervalId;
}

export async function stopTunnelHelper(ctx: Context) {
    ctx.log.debug('stop-tunnel:: Stopping the tunnel now');
    const tunnelRunningStatus = await tunnelInstance?.isRunning();
    ctx.log.debug('stop-tunnel:: Running status of tunnel before stopping ? ' + tunnelRunningStatus);

    const status = await tunnelInstance.stop();
    ctx.log.debug('stop-tunnel:: Tunnel is Stopped ? ' + status);
} 

/**
 * Calculate the number of variants for a snapshot based on the configuration
 * @param config - The configuration object containing web and mobile settings
 * @returns The total number of variants that would be generated
 */
export function calculateVariantCount(config: any): number {
    let variantCount = 0;

    // Calculate web variants
    if (config.web) {
        if (config.web.browserViewports) {
            for (const viewports of Object.values(config.web.browserViewports)) {
                variantCount += (viewports as Array<any>).length;
            }
        } else {
            const browsers = config.web.browsers || [];
            const viewports = config.web.viewports || [];
            variantCount += browsers.length * viewports.length;
        }
    }

    // Calculate mobile variants
    if (config.mobile) {
        const devices = config.mobile.devices || [];
        variantCount += devices.length;
    }

    return variantCount;
}

export function calculateVariantCountFromSnapshot(snapshot: any, globalConfig?: any): number {
    let variantCount = 0;

    // Check snapshot-specific web options
    if (snapshot.options?.web) {
        if (snapshot.options.web.browserViewports) {
            for (const viewports of Object.values(snapshot.options.web.browserViewports)) {
                variantCount += (viewports as Array<any>).length;
            }
        } else {
            const browsers = snapshot.options.web.browsers || [];
            const viewports = snapshot.options.web.viewports || [];
            variantCount += browsers.length * viewports.length;
        }
    }

    // Check snapshot-specific mobile options
    if (snapshot.options?.mobile) {
        const devices = snapshot.options.mobile.devices || [];
        variantCount += devices.length;
    }

    // Fallback to global config if no snapshot-specific options
    if (variantCount === 0 && globalConfig) {
        variantCount = calculateVariantCount(globalConfig);
    }

    return variantCount;
}

export function startPdfPolling(ctx: Context) {
    console.log(chalk.yellow('\nFetching PDF test results...'));

    ctx.log.debug(`Starting fetching results for build: ${ctx.build.id || ctx.build.name}`);
    if (!ctx.build.id && !ctx.build.name) {
        ctx.log.error(chalk.red('Error: Build information not found for fetching results'));
        return
    }

    let attempts = 0;
    const maxAttempts = 60; // 10 minutes (10 seconds * 60)

    console.log(chalk.yellow('Waiting for results...'));

    const projectToken = ctx.env.PROJECT_TOKEN || '';

    const interval = setInterval(async () => {
        attempts++;

        try {
            const response = await ctx.client.getScreenshotData(ctx.build.id, false, ctx.log, projectToken, '');

            if (!response || !response.build) {
                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.log(chalk.red('\nTimeout: Could not fetch PDF results after 10 minutes'));
                }
                return;
            }

            if (response.screenshots && (response.build.build_status_ind === constants.BUILD_COMPLETE || response.build.build_status_ind === constants.BUILD_ERROR)) {
                clearInterval(interval);

                if (response.build.build_type === constants.BUILD_TYPE_OMNI) {
                    const { normalScreenshots, pdfScreenshots } = separateScreenshots(response.screenshots || {});
                    printOmniHeader(response.build, response.project);

                    let pdfGroups: Record<string, any[]> = {};
                    if (pdfScreenshots.length > 0) {
                        const pdfResult = printPdfSection(pdfScreenshots);
                        pdfGroups = pdfResult.pdfGroups;
                    }

                    if (Object.keys(normalScreenshots).length > 0) {
                        printScreenshotSection(normalScreenshots);
                    }

                    const buildResult = response.build.build_status?.toLowerCase() === 'approved' ? 'Passed' : 'Failed';
                    const resultColor = buildResult === 'Passed' ? chalk.green : chalk.red;

                    if (ctx.options.fetchResults) {
                        let filename = `${response.build.build_id}.json`;
                        if (ctx.options.fetchResultsFileName) {
                            filename = `${ctx.options.fetchResultsFileName}`;
                        }
                        const pdfScreenshotsGroup = buildPdfScreenshotsGroup(response.screenshots || {});
                        const output = { ...response, screenshots: normalScreenshots, pdfScreenshots: pdfScreenshotsGroup };
                        fs.writeFileSync(filename, JSON.stringify(output, null, 2));
                        console.log(chalk.green(`\nResults saved to ${filename}`));
                    }
                    console.log(resultColor.bold(`\nResult of Build ${response.build.build_name} : ${buildResult}`));
                } else {
                    // Non-omni build: existing PDF-only behavior
                    const screenshotsArray: any[] = [];
                    for (const [, variants] of Object.entries(response.screenshots || {})) {
                        for (const variant of (variants as any[])) {
                            screenshotsArray.push(variant);
                        }
                    }

                    const pdfGroups = groupScreenshotsByPdf(screenshotsArray);
                    const pdfsWithMismatches = countPdfsWithMismatches(pdfGroups);
                    const pagesWithMismatches = countPagesWithMismatches(screenshotsArray);

                    console.log(chalk.green('\n✓ PDF Test Results:'));
                    console.log(chalk.green(`Build Name: ${response.build.build_name}`));
                    console.log(chalk.green(`Project Name: ${response.project.name}`));
                    console.log(chalk.green(`Total PDFs: ${Object.keys(pdfGroups).length}`));
                    console.log(chalk.green(`Total Pages: ${screenshotsArray.length}`));

                    if (pdfsWithMismatches > 0 || pagesWithMismatches > 0) {
                        console.log(chalk.yellow(`${pdfsWithMismatches} PDFs and ${pagesWithMismatches} Pages in build ${response.build.build_name} have changes present.`));
                    } else {
                        console.log(chalk.green('All PDFs match the baseline.'));
                    }

                    Object.entries(pdfGroups).forEach(([pdfName, pages]) => {
                        const hasMismatch = pages.some(page => isPageMismatch(page));
                        const statusColor = hasMismatch ? chalk.yellow : chalk.green;

                        console.log(statusColor(`\n📄 ${pdfName} (${pages.length} pages)`));

                        pages.forEach(page => {
                            const pageStatusColor = isPageMismatch(page) ? chalk.yellow : chalk.green;
                            const mismatchInfo = page.mismatch_percentage !== undefined ? ` (Mismatch: ${page.mismatch_percentage}%)` : '';
                            console.log(pageStatusColor(`  - Page ${getPageNumber(page.screenshot_name, page.browser_name)}: ${page.status}${mismatchInfo}`));
                        });
                    });

                    if (ctx.options.fetchResults) {
                        let filename = `${response.build.build_id}.json`;
                        if (ctx.options.fetchResultsFileName) {
                            filename = `${ctx.options.fetchResultsFileName}`;
                        }
                        const pdfScreenshotsGroup = buildPdfScreenshotsGroup(response.screenshots || {});
                        const { normalScreenshots: filteredScreenshots } = separateScreenshots(response.screenshots || {});
                        const output = { ...response, screenshots: filteredScreenshots, pdfScreenshots: pdfScreenshotsGroup };
                        fs.writeFileSync(filename, JSON.stringify(output, null, 2));
                        console.log(chalk.green(`\nResults saved to ${filename}`));
                    }
                }

                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.log(chalk.red('\nTimeout: Could not fetch PDF results after 10 minutes'));
                return;
            }

        } catch (error: any) {
            ctx.log.debug(`Error during polling: ${error.message}`);

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.log(chalk.red('\nTimeout: Could not fetch PDF results after 10 minutes'));
                if (error.response && error.response.data) {
                    console.log(chalk.red(`Error details: ${JSON.stringify(error.response.data)}`));
                } else {
                    console.log(chalk.red(`Error details: ${error.message}`));
                }
                return;
            }
            process.stdout.write(chalk.yellow('.'));
        }
    }, 10000);
}

// --- PDF/Screenshot detection and extraction helpers ---

function isPdfScreenshot(variant: any): boolean {
    return variant.browser_name && variant.browser_name.endsWith('.pdf');
}

function extractPdfNameAndPage(screenshotName: string, browserName: string): { pdfName: string, pageNumber: string } {
    // Find the last occurrence of ".pdf#" to handle hashes in user-provided names
    // e.g., "my#report.pdf#3" → pdfName: "my#report.pdf", pageNumber: "3"
    const marker = '.pdf#';
    const lastIdx = screenshotName.lastIndexOf(marker);
    if (lastIdx !== -1) {
        return {
            pdfName: screenshotName.substring(0, lastIdx + 4), // include ".pdf"
            pageNumber: screenshotName.substring(lastIdx + 5)  // after "#"
        };
    }
    // Fallback: use browser_name as pdf name
    return { pdfName: browserName, pageNumber: '1' };
}

function buildPdfScreenshotsGroup(screenshots: Record<string, any[]>): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const [, variants] of Object.entries(screenshots || {})) {
        for (const variant of variants) {
            if (isPdfScreenshot(variant)) {
                const { pdfName, pageNumber } = extractPdfNameAndPage(variant.screenshot_name, variant.browser_name);
                if (!grouped[pdfName]) {
                    grouped[pdfName] = [];
                }
                const { browser_name, screenshot_name, ...rest } = variant;
                grouped[pdfName].push({
                    ...rest,
                    documentName: pdfName,
                    pageNo: parseInt(pageNumber, 10)
                });
            }
        }
    }

    return grouped;
}

function separateScreenshots(screenshots: Record<string, any[]>): { normalScreenshots: Record<string, any[]>, pdfScreenshots: any[] } {
    const normalScreenshots: Record<string, any[]> = {};
    const pdfScreenshots: any[] = [];

    for (const [name, variants] of Object.entries(screenshots || {})) {
        if (variants.length > 0 && isPdfScreenshot(variants[0])) {
            for (const variant of variants) {
                pdfScreenshots.push(variant);
            }
        } else {
            normalScreenshots[name] = variants;
        }
    }

    return { normalScreenshots, pdfScreenshots };
}

// --- Status helpers ---

const NON_MISMATCH_STATUSES = ['Approved', 'moved', 'new-screenshot'];

function isPageMismatch(page: any): boolean {
    return !NON_MISMATCH_STATUSES.includes(page.status);
}

interface StatusCounts {
    total: number;
    mismatches: number;
    new: number;
    changesFound: number;
    approved: number;
    rejected: number;
    addedToBaseline: number;
}

function getStatusCategory(status: string): keyof Omit<StatusCounts, 'total' | 'mismatches'> | null {
    switch (status) {
        case 'new-screenshot': return 'new';
        case 'Changes Found':
        case 'Under Screening': return 'changesFound';
        case 'Approved': return 'approved';
        case 'Rejected': return 'rejected';
        case 'moved': return 'addedToBaseline';
        default: return null;
    }
}

function countItemsByStatus(items: any[]): StatusCounts {
    const counts: StatusCounts = { total: items.length, mismatches: 0, new: 0, changesFound: 0, approved: 0, rejected: 0, addedToBaseline: 0 };
    for (const item of items) {
        if (isPageMismatch(item)) counts.mismatches++;
        const cat = getStatusCategory(item.status);
        if (cat) counts[cat]++;
    }
    return counts;
}

function countGroupsByStatus(groups: Record<string, any[]>): StatusCounts {
    const counts: StatusCounts = { total: Object.keys(groups).length, mismatches: 0, new: 0, changesFound: 0, approved: 0, rejected: 0, addedToBaseline: 0 };
    for (const items of Object.values(groups)) {
        if (items.some(i => isPageMismatch(i))) counts.mismatches++;
        if (items.some(i => i.status === 'new-screenshot')) counts.new++;
        if (items.some(i => i.status === 'Changes Found' || i.status === 'Under Screening')) counts.changesFound++;
        if (items.every(i => i.status === 'Approved')) counts.approved++;
        if (items.some(i => i.status === 'Rejected')) counts.rejected++;
        if (items.some(i => i.status === 'moved')) counts.addedToBaseline++;
    }
    return counts;
}

// --- PDF grouping and formatting ---

function groupScreenshotsByPdf(screenshots: any[]): Record<string, any[]> {
    const pdfGroups: Record<string, any[]> = {};

    screenshots.forEach(screenshot => {
        const { pdfName } = extractPdfNameAndPage(screenshot.screenshot_name, screenshot.browser_name);

        if (!pdfGroups[pdfName]) {
            pdfGroups[pdfName] = [];
        }

        pdfGroups[pdfName].push(screenshot);
    });

    return pdfGroups;
}

function countPdfsWithMismatches(pdfGroups: Record<string, any[]>): number {
    let count = 0;

    Object.values(pdfGroups).forEach(pages => {
        if (pages.some(page => isPageMismatch(page))) {
            count++;
        }
    });

    return count;
}

function countPagesWithMismatches(screenshots: any[]): number {
    return screenshots.filter(screenshot => isPageMismatch(screenshot)).length;
}

function formatPdfsForOutput(pdfGroups: Record<string, any[]>): any[] {
    return Object.entries(pdfGroups).map(([pdfName, pages]) => {
        return {
            pdfName,
            pageCount: pages.length,
            pages: pages.map(page => ({
                pageNumber: extractPdfNameAndPage(page.screenshot_name, page.browser_name).pageNumber,
                screenshotId: page.captured_image_id,
                mismatchPercentage: page.mismatch_percentage,
                status: page.status,
                screenshotUrl: page.shareable_link
            }))
        };
    });
}

function formatScreenshotsForOutput(screenshots: Record<string, any[]>): any[] {
    return Object.entries(screenshots).map(([name, variants]) => {
        return {
            screenshotName: name,
            variantCount: variants.length,
            variants: variants.map(variant => ({
                variantId: variant.captured_image_id,
                browser: variant.browser_name,
                viewport: variant.viewport,
                os: variant.os,
                mismatchPercentage: variant.mismatch_percentage,
                status: variant.status,
                screenshotUrl: variant.shareable_link
            }))
        };
    });
}

// --- Omni display helpers ---

function printOmniHeader(build: any, project: any) {
    console.log(chalk.green.bold(`\nProject Name: ${project.name}`));
    console.log(chalk.green.bold(`Build Name: ${build.build_name}`));
    console.log(chalk.green.bold(`Build ID: ${build.build_id}`));
    console.log(chalk.green.bold(`Build Status: ${build.build_status}`));
    const buildResult = build.build_status?.toLowerCase() === 'approved' ? 'Passed' : 'Failed';
    const resultColor = buildResult === 'Passed' ? chalk.green : chalk.red;
    console.log(resultColor.bold(`Build Result : ${buildResult}`));
    console.log(chalk.green.bold(`Branch Name: ${build.branch}`));
    console.log(chalk.white('-----'));
}

function printPdfSection(pdfScreenshots: any[]) {
    const pdfGroups = groupScreenshotsByPdf(pdfScreenshots);
    const pageCounts = countItemsByStatus(pdfScreenshots);
    const pdfCounts = countGroupsByStatus(pdfGroups);

    console.log(chalk.green.bold('\nPDF Test Results:'));
    console.log(chalk.green(`Total PDFs: ${pdfCounts.total}`));
    console.log(chalk.green(`Total Pages: ${pageCounts.total}`));

    if (pageCounts.mismatches > 0 || pdfCounts.mismatches > 0) {
        console.log(chalk.yellow(`\n${pageCounts.mismatches} page(s) and ${pdfCounts.mismatches} PDF(s) have mismatches`));
    }

    if (pageCounts.new > 0 || pdfCounts.new > 0) console.log(chalk.cyan(`${pageCounts.new} page(s) and ${pdfCounts.new} PDF(s) are new`));
    if (pageCounts.changesFound > 0 || pdfCounts.changesFound > 0) console.log(chalk.yellow(`${pageCounts.changesFound} page(s) and ${pdfCounts.changesFound} PDF(s) have changes found`));
    if (pageCounts.approved > 0 || pdfCounts.approved > 0) console.log(chalk.green(`${pageCounts.approved} page(s) and ${pdfCounts.approved} PDF(s) are approved`));
    if (pageCounts.addedToBaseline > 0 || pdfCounts.addedToBaseline > 0) console.log(chalk.green(`${pageCounts.addedToBaseline} page(s) and ${pdfCounts.addedToBaseline} PDF(s) are added to baseline`));
    if (pageCounts.rejected > 0 || pdfCounts.rejected > 0) console.log(chalk.red(`${pageCounts.rejected} page(s) and ${pdfCounts.rejected} PDF(s) have been rejected`));

    console.log(chalk.white('-----'));

    return { pdfGroups, pageCounts, pdfCounts };
}

function printScreenshotSection(normalScreenshots: Record<string, any[]>) {
    const allVariants: any[] = [];
    for (const variants of Object.values(normalScreenshots)) {
        for (const v of variants) allVariants.push(v);
    }

    const variantCounts = countItemsByStatus(allVariants);
    const screenshotCounts = countGroupsByStatus(normalScreenshots);

    console.log(chalk.green.bold('\nScreenshot Test Results:'));
    console.log(chalk.green(`Total Screenshots: ${screenshotCounts.total}`));
    console.log(chalk.green(`Total Variants: ${variantCounts.total}`));

    if (variantCounts.mismatches > 0 || screenshotCounts.mismatches > 0) {
        console.log(chalk.yellow(`\n${variantCounts.mismatches} variant(s) and ${screenshotCounts.mismatches} screenshot(s) have mismatches`));
    }

    if (variantCounts.new > 0 || screenshotCounts.new > 0) console.log(chalk.cyan(`${variantCounts.new} variant(s) and ${screenshotCounts.new} screenshot(s) are new`));
    if (variantCounts.changesFound > 0 || screenshotCounts.changesFound > 0) console.log(chalk.yellow(`${variantCounts.changesFound} variant(s) and ${screenshotCounts.changesFound} screenshot(s) have changes found`));
    if (variantCounts.approved > 0 || screenshotCounts.approved > 0) console.log(chalk.green(`${variantCounts.approved} variant(s) and ${screenshotCounts.approved} screenshot(s) are approved`));
    if (variantCounts.addedToBaseline > 0 || screenshotCounts.addedToBaseline > 0) console.log(chalk.green(`${variantCounts.addedToBaseline} variant(s) and ${screenshotCounts.addedToBaseline} screenshot(s) are added to baseline`));
    if (variantCounts.rejected > 0 || screenshotCounts.rejected > 0) console.log(chalk.red(`${variantCounts.rejected} variant(s) and ${screenshotCounts.rejected} screenshot(s) have been rejected`));

    return { variantCounts, screenshotCounts };
}

function getPageNumber(screenshotName: string, browserName?: string): string {
    return extractPdfNameAndPage(screenshotName, browserName || '').pageNumber;
}

export function validateCoordinates(
    coordString: string, 
    pageHeight: number,
    pageWidth: number,
    snapshotName: string
): { valid: boolean, error?: string, coords?: { top: number, bottom: number, left: number, right: number } } {
    
    const coords = coordString.split(',').map(Number);
    
    if (coords.length !== 4) {
        return { 
            valid: false, 
            error: `for snapshot ${snapshotName}, invalid coordinates format: ${coordString}. Expected: top,bottom,left,right` 
        };
    }
    
    const [top, bottom, left, right] = coords;
    
    if (coords.some(isNaN)) {
        return { 
            valid: false, 
            error: `for snapshot ${snapshotName}, invalid coordinate values: ${coordString}. All values must be numbers` 
        };
    }
    
    if (top < 0 || left < 0 || bottom < 0 || right < 0) {
        return { 
            valid: false, 
            error: `for snapshot ${snapshotName}, invalid coordinate bounds: ${coordString}. top,left,bottom,right must be >= 0` 
        };
    }
    
    if (top >= bottom) {
        return { 
            valid: false, 
            error: `for snapshot ${snapshotName}, invalid coordinate bounds: ${coordString}. top must be < bottom` 
        };
    }
    
    if (left >= right) {
        return { 
            valid: false, 
            error: `for snapshot ${snapshotName}, invalid coordinate bounds: ${coordString}. left must be < right` 
        };
    }
    
    if (bottom > pageHeight) {
        return { 
            valid: false, 
            error: `for snapshot ${snapshotName}, coordinates exceed viewport bounds: ${coordString}. bottom (${bottom}) exceeds viewport height (${pageHeight})` 
        };
    }
    
    if (right > pageWidth) {
        return { 
            valid: false, 
            error: `for snapshot ${snapshotName}, coordinates exceed viewport bounds: ${coordString}. right (${right}) exceeds viewport width (${pageWidth})` 
        };
    }
    
    return { 
        valid: true, 
        coords: { top, bottom, left, right } 
    };
}

export function createBasicAuthToken(username: string, accessKey: string): string {
    const credentials = `${username}:${accessKey}`;
    return Buffer.from(credentials).toString('base64');
}

export async function listenToSmartUISSE(
    baseURL: string,
    accessToken: string,
    ctx: Context,
    onEvent?: (eventType: string, data: any) => void
): Promise<{ abort: () => void }> {
    const url = `${baseURL}/api/v1/sse/smartui`;
    
    const abortController = new AbortController();
    
    try {
        const cookieKey = baseURL === 'https://server-events.lambdatest.com' ? 'accessToken' : 'stageAccessToken';
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Cookie': `${cookieKey}=Basic ${accessToken}`
            },
            signal: abortController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        onEvent?.('open', { status: 'connected' });

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body reader available');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                
                buffer += chunk;
                const lines = buffer.split('\n');
                
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        currentEvent = line.substring(6).trim(); 
                    } 
                    else if (line.startsWith('data:')) {
                        const data = line.substring(5).trim(); 
                        
                        if (data) {
                            try {
                                const parsedData = JSON.parse(data);
                                onEvent?.(currentEvent, parsedData);
                            } catch (parseError) {
                                if (currentEvent === 'connection' && data === 'connected') {
                                    onEvent?.(currentEvent, { status: 'connected', message: data });
                                } else {
                                    onEvent?.(currentEvent, data);
                                }
                            }
                        }
                    } 
                    else if (line.trim() === '') {
                        currentEvent = '';
                    }
                }
            }
        } catch (streamError: any) {
            ctx.log.debug('SSE Streaming error:', streamError);
            onEvent?.('error', streamError);
        } finally {
            reader.releaseLock();
        }

    } catch (error) {
        ctx.log.debug('SSE Connection error:', error);
        onEvent?.('error', error);
    }

    return {
        abort: () => abortController.abort()
    };
}

export async function startSSEListener(ctx: Context) {
    let currentConnection: { abort: () => void } | null = null;
    let errorCount = 0;
    
    try {
        ctx.log.debug('Attempting SSE connection');
        const accessKey = ctx.env.LT_ACCESS_KEY;
        const username = ctx.env.LT_USERNAME;
        
        const basicAuthToken = createBasicAuthToken(username, accessKey);
        ctx.log.debug(`Basic auth token: ${basicAuthToken}`);
        currentConnection = await listenToSmartUISSE(
            ctx.env.SMARTUI_SSE_URL,
            basicAuthToken,
            ctx,
            (eventType, data) => {
                switch (eventType) {
                    case 'open':
                        ctx.log.debug('Connected to SSE server');
                        break;
                        
                    case 'connection':
                        ctx.log.debug('Connection confirmed:', data);
                        break;
                        
                    case 'Dot_buildCompleted':
                        ctx.log.debug('Build completed');
                        ctx.log.info(chalk.green.bold('Build completed'));
                        process.exit(0);
                    case 'DOTUIError':
                        if (data.buildId== ctx.build.id) {
                            errorCount++;
                            ctx.log.info(chalk.red.bold(`Error: ${data.message}`));
                        }
                        break;
                    case 'DOTUIWarning':
                        if (data.buildId== ctx.build.id) {
                            ctx.log.info(chalk.yellow.bold(`Warning: ${data.message}`));
                        }
                        break;
                    case 'error':
                        ctx.log.debug('SSE Error occurred:', data);
                        currentConnection?.abort();
                        return;
                }
            }
        );

    } catch (error) {
        ctx.log.debug('Failed to start SSE listener:', error);
    }
}

/**
 * Validates if a string contains valid CSS syntax
 * @param cssString - The CSS string to validate
 * @returns true if valid CSS, false otherwise
 */
export function isValidCSS(cssString: string): boolean {
    if (!cssString || typeof cssString !== 'string' || cssString.trim().length === 0) {
        return false;
    }

    const trimmed = cssString.trim();
    
    // Basic CSS validation patterns
    // Check for balanced braces
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
        return false;
    }

    // Check for basic CSS structure (selector { property: value; })
    // Allow comments /* */ and media queries
    const cssPattern = /^[\s\S]*[\{\}][\s\S]*$/;
    
    // Must contain at least one CSS rule or be empty
    if (trimmed.length > 0 && !cssPattern.test(trimmed)) {
        // Allow single-line rules without newlines
        const singleRulePattern = /^[^{]+\{[^}]+\}$/;
        if (!singleRulePattern.test(trimmed)) {
            return false;
        }
    }

    return true;
}

/**
 * Resolves customCSS from either a file path or inline CSS string
 * @param cssValue - The CSS value from config (file path or inline CSS)
 * @param configPath - The path to the config file (for resolving relative paths)
 * @param logger - Logger instance for debug messages
 * @returns Resolved CSS string or throws error if invalid
 */
export function resolveCustomCSS(cssValue: string, configPath: string, logger: any): string {
    if (!cssValue || typeof cssValue !== 'string') {
        throw new Error('customCSS must be a non-empty string');
    }

    const trimmed = cssValue.trim();
    if (trimmed.length === 0) {
        throw new Error('customCSS cannot be empty');
    }

    // Check if it looks like a file path
    const path = require('path');
    const isLikelyFilePath = 
        trimmed.endsWith('.css') || 
        trimmed.startsWith('./') || 
        trimmed.startsWith('../') || 
        trimmed.startsWith('/') ||
        path.isAbsolute(trimmed);

    if (isLikelyFilePath) {
        logger.debug(`customCSS appears to be a file path: ${trimmed}`);
        
        // Validate file extension
        const ext = path.extname(trimmed).toLowerCase();
        if (ext && ext !== '.css') {
            throw new Error(`Invalid customCSS file type: ${ext}. Only .css files are supported.`);
        }

        // Resolve the file path
        const baseDir = path.dirname(configPath);
        const resolvedPath = path.isAbsolute(trimmed) 
            ? trimmed 
            : path.resolve(baseDir, trimmed);

        logger.debug(`Resolved customCSS file path: ${resolvedPath}`);

        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`customCSS file not found: ${resolvedPath}`);
        }

        // Check if it's a file (not a directory)
        const stats = fs.statSync(resolvedPath);
        if (!stats.isFile()) {
            throw new Error(`customCSS path is not a file: ${resolvedPath}`);
        }

        // Read the file
        try {
            const cssContent = fs.readFileSync(resolvedPath, 'utf-8');
            logger.debug(`Read ${cssContent.length} characters from customCSS file`);
            
            return cssContent;
        } catch (error: any) {
            if (error.message.includes('Invalid CSS syntax')) {
                throw error;
            }
            throw new Error(`Failed to read customCSS file: ${error.message}`);
        }
    } else {
        // Treat as inline CSS
        logger.debug('customCSS appears to be inline CSS');
        return trimmed;
    }
}


/**
 * Parse CSS content and extract selectors with their rules
 * @param cssContent - The CSS content to parse
 * @returns Array of parsed CSS rules with selectors
 */
export function parseCSSFile(cssContent: string): Array<{
    selector: string;
    declarations: Array<{ property: string; value: string; important: boolean }>;
    source?: { start?: any; end?: any };
}> {
    const rules: Array<{
        selector: string;
        declarations: Array<{ property: string; value: string; important: boolean }>;
        source?: { start?: any; end?: any };
    }> = [];
    
    try {
        const ast = postcss.parse(cssContent);
        
        ast.walkRules((rule: any) => {
            const declarations: Array<{ property: string; value: string; important: boolean }> = [];
            
            rule.walkDecls((decl: any) => {
                declarations.push({
                    property: decl.prop,
                    value: decl.value,
                    important: decl.important
                });
            });
            
            rules.push({
                selector: rule.selector,
                declarations: declarations,
                source: {
                    start: rule.source?.start,
                    end: rule.source?.end
                }
            });
        });
    } catch (error: any) {
        throw new Error(`Failed to parse CSS: ${error.message}`);
    }
    
    return rules;
}

/**
 * Validate CSS selectors in the page context
 * @param page - Playwright page object
 * @param cssRules - Parsed CSS rules
 * @param logger - Logger instance
 * @returns Validation results with success and failed selectors
 */
export async function validateCSSSelectors(
    page: any,
    cssRules: Array<{ selector: string; declarations: any[] }>,
    logger: any
): Promise<{
    successCount: number;
    failedSelectors: string[];
    totalRules: number;
}> {
    const failedSelectors: string[] = [];
    let successCount = 0;

    for (const rule of cssRules) {
        const selector = rule.selector;
        
        // Skip pseudo-selectors, media queries, and special selectors that can't be validated
        if (
            selector.includes(':') || 
            selector.includes('@') ||
            selector.includes('::')
        ) {
            successCount++; // Count as success since they're valid CSS
            continue;
        }

        try {
            // Validate if selector finds at least one element
            const elementExists = await page.evaluate(({ selectorValue }: { selectorValue: string }) => {
                try {
                    const elements = document.querySelectorAll(selectorValue);
                    return elements.length > 0;
                } catch (error) {
                    return false;
                }
            }, { selectorValue: selector });

            if (elementExists) {
                successCount++;
                logger.debug(`CSS selector valid: ${selector}`);
            } else {
                failedSelectors.push(selector);
                logger.debug(`CSS selector found no elements: ${selector}`);
            }
        } catch (error: any) {
            failedSelectors.push(selector);
            logger.debug(`CSS selector validation error for "${selector}": ${error.message}`);
        }
    }

    return {
        successCount,
        failedSelectors,
        totalRules: cssRules.length
    };
}

/**
 * Generate CSS injection report
 * @param validationResult - Results from CSS selector validation
 * @param logger - Logger instance
 * @returns Formatted report string
 */
export function generateCSSInjectionReport(
    validationResult: {
        successCount: number;
        failedSelectors: string[];
        totalRules: number;
    },
    logger: any
): string {
    const lines: string[] = [];
    
    lines.push(chalk.cyan('[SmartUI] CSS Injection Report:'));
    
    if (validationResult.successCount > 0) {
        lines.push(chalk.green(`[SmartUI] ✅ Success: ${validationResult.successCount} rules applied.`));
    }
    
    if (validationResult.failedSelectors.length > 0) {
        lines.push(chalk.yellow(`[SmartUI] ⚠️  Warning: ${validationResult.failedSelectors.length} selector(s) failed to find an element:`));
        validationResult.failedSelectors.forEach(selector => {
            lines.push(chalk.yellow(`[SmartUI]   - ${selector}`));
        });
    }
    
    const report = lines.join('\n');
    logger.info(report);
    
    return report;
}