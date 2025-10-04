import { Context } from '../types.js'
import { chromium, firefox, webkit, Browser } from '@playwright/test'
import constants from './constants.js';
import chalk from 'chalk';
import axios from 'axios';
import fs from 'fs';
import { globalAgent } from 'http';
import { promisify } from 'util'
import { build } from 'tsup';
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

export async function launchBrowsers(ctx: Context): Promise<Record<string, Browser>> {
    let browsers: Record<string, Browser> = {};
    const isHeadless = process.env.HEADLESS?.toLowerCase() === 'false' ? false : true;
    let launchOptions: Record<string, any> = { headless: isHeadless };

    if (ctx.config.web) {
        for (const browser of ctx.config.web.browsers) {
            switch (browser) {
                case constants.CHROME:
                    browsers[constants.CHROME] = await chromium.launch(launchOptions);
                    break;
                case constants.SAFARI:
                    browsers[constants.SAFARI] = await webkit.launch(launchOptions);
                    break;
                case constants.FIREFOX:
                    browsers[constants.FIREFOX] = await firefox.launch(launchOptions);
                    break;
                case constants.EDGE:
                    launchOptions.args = ['--headless=new'];
                    browsers[constants.EDGE] = await chromium.launch({ channel: constants.EDGE_CHANNEL, ...launchOptions });
                    break;
            }
        }
    }
    if (ctx.config.mobile) {
        for (const device of ctx.config.mobile.devices) {
            if (constants.SUPPORTED_MOBILE_DEVICES[device].os === 'android' && !browsers[constants.CHROME]) browsers[constants.CHROME] = await chromium.launch(launchOptions);
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
        for (const viewport of ctx.config.web.viewports) {
            webRenderViewports.push({
                viewport,
                viewportString: `${viewport.width}${viewport.height ? 'x' + viewport.height : ''}`,
                fullPage: viewport.height ? false : true,
                device: false
            })
        }
    }

    return webRenderViewports
}

export function getWebRenderViewportsForOptions(options: any): Array<Record<string, any>> {
    let webRenderViewports: Array<Record<string, any>> = [];

    if (options.web && Array.isArray(options.web.viewports)) {
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
                    viewportString: `${viewport[0]}${viewport[1] ? 'x' + viewport[1] : ''}`,
                    fullPage: viewport.length === 1,
                    device: false
                });
            }
        }
    }

    return webRenderViewports;
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
            fs.writeFileSync(`${fileName}`, JSON.stringify(resp, null, 2));
            ctx.log.debug(`Updated results in ${fileName}`);

            if (resp.build.build_status_ind === constants.BUILD_COMPLETE || resp.build.build_status_ind === constants.BUILD_ERROR) {
                clearInterval(intervalId);
                ctx.log.info(`Fetching results completed. Final results written to ${fileName}`);


                // Evaluating Summary
                let totalScreenshotsWithMismatches = 0;
                let totalVariantsWithMismatches = 0;
                const totalScreenshots = Object.keys(resp.screenshots || {}).length;
                let totalVariants = 0;

                for (const [screenshot, variants] of Object.entries(resp.screenshots || {})) {
                    let screenshotHasMismatch = false;
                    let variantMismatchCount = 0;

                    totalVariants += variants.length; // Add to total variants count

                    for (const variant of variants) {
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
    const tunnelRunningStatus = await tunnelInstance.isRunning();
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
        const browsers = config.web.browsers || [];
        const viewports = config.web.viewports || [];
        variantCount += browsers.length * viewports.length;
    }

    // Calculate mobile variants
    if (config.mobile) {
        const devices = config.mobile.devices || [];
        variantCount += devices.length;
    }

    return variantCount;
}

/**
 * Calculate the number of variants for a snapshot based on snapshot-specific options
 * @param snapshot - The snapshot object with options
 * @param globalConfig - The global configuration object (fallback)
 * @returns The total number of variants that would be generated
 */
export function calculateVariantCountFromSnapshot(snapshot: any, globalConfig?: any): number {
    let variantCount = 0;
    

    // Check snapshot-specific web options
    if (snapshot.options?.web) {
        const browsers = snapshot.options.web.browsers || [];
        const viewports = snapshot.options.web.viewports || [];
        variantCount += browsers.length * viewports.length;
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

    if (!ctx.env.LT_USERNAME || !ctx.env.LT_ACCESS_KEY) {
        console.log(chalk.red('Error: LT_USERNAME and LT_ACCESS_KEY environment variables are required for fetching results'));
        return;
    }

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (10 seconds * 30)

    console.log(chalk.yellow('Waiting for results...'));

    const interval = setInterval(async () => {
        attempts++;

        try {
            const response = await ctx.client.fetchPdfResults(ctx);

            if (response.screenshots && response.build?.build_status === constants.BUILD_COMPLETE) {
                clearInterval(interval);

                const pdfGroups = groupScreenshotsByPdf(response.screenshots);
                const pdfsWithMismatches = countPdfsWithMismatches(pdfGroups);
                const pagesWithMismatches = countPagesWithMismatches(response.screenshots);

                console.log(chalk.green('\n✓ PDF Test Results:'));
                console.log(chalk.green(`Build Name: ${response.build.name}`));
                console.log(chalk.green(`Project Name: ${response.project.name}`));
                console.log(chalk.green(`Total PDFs: ${Object.keys(pdfGroups).length}`));
                console.log(chalk.green(`Total Pages: ${response.screenshots.length}`));

                if (pdfsWithMismatches > 0 || pagesWithMismatches > 0) {
                    console.log(chalk.yellow(`${pdfsWithMismatches} PDFs and ${pagesWithMismatches} Pages in build ${response.build.name} have changes present.`));
                } else {
                    console.log(chalk.green('All PDFs match the baseline.'));
                }

                Object.entries(pdfGroups).forEach(([pdfName, pages]) => {
                    const hasMismatch = pages.some(page => page.mismatch_percentage > 0);
                    const statusColor = hasMismatch ? chalk.yellow : chalk.green;

                    console.log(statusColor(`\n📄 ${pdfName} (${pages.length} pages)`));

                    pages.forEach(page => {
                        const pageStatusColor = page.mismatch_percentage > 0 ? chalk.yellow : chalk.green;
                        console.log(pageStatusColor(`  - Page ${getPageNumber(page.screenshot_name)}: ${page.status} (Mismatch: ${page.mismatch_percentage}%)`));
                    });
                });

                const formattedResults = {
                    status: 'success',
                    data: {
                        buildId: response.build.id,
                        buildName: response.build.name,
                        projectName: response.project.name,
                        buildStatus: response.build.build_satus,
                        pdfs: formatPdfsForOutput(pdfGroups)
                    }
                };

                // Save results to file if filename provided
                if (ctx.options.fetchResults && ctx.options.fetchResultsFileName) {
                    const filename = ctx.options.fetchResultsFileName !== '' ? ctx.options.fetchResultsFileName : 'pdf-results.json';

                    fs.writeFileSync(filename, JSON.stringify(formattedResults, null, 2));
                    console.log(chalk.green(`\nResults saved to ${filename}`));
                }

                return;
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.log(chalk.red('\nTimeout: Could not fetch PDF results after 5 minutes'));
                return;
            }

        } catch (error: any) {
            ctx.log.debug(`Error during polling: ${error.message}`);

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.log(chalk.red('\nTimeout: Could not fetch PDF results after 5 minutes'));
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

function groupScreenshotsByPdf(screenshots: any[]): Record<string, any[]> {
    const pdfGroups: Record<string, any[]> = {};

    screenshots.forEach(screenshot => {
        // screenshot name format: "pdf-name.pdf#page-number"
        const pdfName = screenshot.screenshot_name.split('#')[0];

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
        if (pages.some(page => page.mismatch_percentage > 0)) {
            count++;
        }
    });

    return count;
}

function countPagesWithMismatches(screenshots: any[]): number {
    return screenshots.filter(screenshot => screenshot.mismatch_percentage > 0).length;
}

function formatPdfsForOutput(pdfGroups: Record<string, any[]>): any[] {
    return Object.entries(pdfGroups).map(([pdfName, pages]) => {
        return {
            pdfName,
            pageCount: pages.length,
            pages: pages.map(page => ({
                pageNumber: getPageNumber(page.screenshot_name),
                screenshotId: page.captured_image_id,
                mismatchPercentage: page.mismatch_percentage,
                status: page.status,
                screenshotUrl: page.shareable_link
            }))
        };
    });
}

function getPageNumber(screenshotName: string): string {
    const parts = screenshotName.split('#');
    return parts.length > 1 ? parts[1] : '1';
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
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Cookie': `stageAccessToken=Basic ${accessToken}`
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