import fs from 'fs'
import { Context } from '../types.js'
import { chromium, firefox, webkit, Browser } from '@playwright/test'
import constants from './constants.js';
import chalk from 'chalk';
import axios from 'axios';

import { globalAgent } from 'http';
import { promisify } from 'util'
const sleep = promisify(setTimeout);

let isPollingActive = false;
let globalContext: Context;
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
                            remoteWindow.scrollTo(0,0)
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
                    browsers[constants.EDGE] = await chromium.launch({channel: constants.EDGE_CHANNEL, ...launchOptions});
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

export function getWebRenderViewports(ctx: Context): Array<Record<string,any>> {
    let webRenderViewports: Array<Record<string,any>> = [];

    if (ctx.config.web) {
        for (const viewport of ctx.config.web.viewports) {
            webRenderViewports.push({
                viewport,
                viewportString: `${viewport.width}${viewport.height ? 'x'+viewport.height : ''}`,
                fullPage: viewport.height ? false : true,
                device: false
            })
        }
    }

    return webRenderViewports
}

export function getWebRenderViewportsForOptions(options: any): Array<Record<string,any>> {
    let webRenderViewports: Array<Record<string,any>> = [];

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
                    viewportString: `${viewport[0]}${viewport[1] ? 'x'+viewport[1] : ''}`,
                    fullPage: viewport.length === 1,
                    device: false
                });
            }
        }
    }

    return webRenderViewports;
}

export function getMobileRenderViewports(ctx: Context): Record<string,any> {
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

export function getMobileRenderViewportsForOptions(options: any): Record<string,any> {
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
            if (options.mobile.fullPage === undefined || options.mobile.fullPage){
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

export function getRenderViewports(ctx: Context): Array<Record<string,any>> {
    let mobileRenderViewports = getMobileRenderViewports(ctx);
    let webRenderViewports = getWebRenderViewports(ctx);
    
    // Combine arrays ensuring web viewports are first
    return [
        ...webRenderViewports,
        ...mobileRenderViewports[constants.MOBILE_OS_IOS],
        ...mobileRenderViewports[constants.MOBILE_OS_ANDROID]
    ];
}

export function getRenderViewportsForOptions(options: any): Array<Record<string,any>> {
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
process.on('SIGINT', async () => {
    if (isPollingActive) {
        console.log('Fetching results interrupted. Exiting...');
        isPollingActive = false;
    } else {
        console.log('\nExiting gracefully...');
    }
    process.exit(0);
});

// Background polling function
export async function startPolling(ctx: Context): Promise<void> {
    ctx.log.info('Fetching results in progress....');
    ctx.log.debug(ctx.build);
    isPollingActive = true;

    const intervalId = setInterval(async () => {
        if (!isPollingActive) {
            clearInterval(intervalId);
            return;
        }
        
        try {
            const resp = await ctx.client.getScreenshotData(ctx.build.id, ctx.build.baseline || false, ctx.log);

            if (!resp.build) {
                ctx.log.info("Error: Build data is null.");
                clearInterval(intervalId);
                isPollingActive = false;
            }

            fs.writeFileSync(ctx.options.fetchResultsFileName, JSON.stringify(resp, null, 2));
            ctx.log.debug(`Updated results in ${ctx.options.fetchResultsFileName}`);

            if (resp.build.build_status_ind === constants.BUILD_COMPLETE || resp.build.build_status_ind === constants.BUILD_ERROR) {
                clearInterval(intervalId);
                ctx.log.info(`Fetching results completed. Final results written to ${ctx.options.fetchResultsFileName}`);
                isPollingActive = false;


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
                        `\nSummary of Mismatches:\n` +
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
            isPollingActive = false;
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

    // Start the polling interval
    pingIntervalId = setInterval(async () => {
        try {
            ctx.log.debug('Sending ping to server...');
            await ctx.client.ping(ctx.build.id, ctx.log);
            ctx.log.debug('Ping sent successfully.');
        } catch (error: any) {
            ctx.log.error(`Error during ping polling: ${error.message}`);
        }
    }, 10 * 60 * 1000); // 10 minutes interval
}

export function startPdfPolling(ctx: Context) {
    console.log(chalk.yellow('\nFetching PDF test results...'));
    
    // Use buildId if available, otherwise use buildName
    const buildName = ctx.options.buildName || ctx.pdfBuildName;
    const buildId = ctx.pdfBuildId;
    
    if (!buildId && !buildName) {
        console.log(chalk.red('Error: Build information not found for fetching results'));
        return;
    }
    
    // Verify authentication credentials
    if (!ctx.env.LT_USERNAME || !ctx.env.LT_ACCESS_KEY) {
        console.log(chalk.red('Error: LT_USERNAME and LT_ACCESS_KEY environment variables are required for fetching results'));
        return;
    }
    
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes (10 seconds * 30)
    
    console.log(chalk.yellow('Waiting for results...'));
    
    const interval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await ctx.client.fetchPdfResults(buildName, buildId, ctx.log);
            
            if (response.status === 'success' && response.data && response.data.Screenshots) {
                clearInterval(interval);
                
                // Group screenshots by PDF name
                const pdfGroups = groupScreenshotsByPdf(response.data.Screenshots);
                
                // Count PDFs with mismatches
                const pdfsWithMismatches = countPdfsWithMismatches(pdfGroups);
                const pagesWithMismatches = countPagesWithMismatches(response.data.Screenshots);
                
                // Display summary in terminal
                console.log(chalk.green('\n✓ PDF Test Results:'));
                console.log(chalk.green(`Build Name: ${response.data.buildName}`));
                console.log(chalk.green(`Project Name: ${response.data.projectName}`));
                console.log(chalk.green(`Total PDFs: ${Object.keys(pdfGroups).length}`));
                console.log(chalk.green(`Total Pages: ${response.data.Screenshots.length}`));
                
                if (pdfsWithMismatches > 0 || pagesWithMismatches > 0) {
                    console.log(chalk.yellow(`${pdfsWithMismatches} PDFs and ${pagesWithMismatches} Pages in build ${response.data.buildName} have changes present.`));
                } else {
                    console.log(chalk.green('All PDFs match the baseline.'));
                }
                
                // Display each PDF and its pages
                Object.entries(pdfGroups).forEach(([pdfName, pages]) => {
                    const hasMismatch = pages.some(page => page.mismatchPercentage > 0);
                    const statusColor = hasMismatch ? chalk.yellow : chalk.green;
                    
                    console.log(statusColor(`\n📄 ${pdfName} (${pages.length} pages)`));
                    
                    pages.forEach(page => {
                        const pageStatusColor = page.mismatchPercentage > 0 ? chalk.yellow : chalk.green;
                        console.log(pageStatusColor(`  - Page ${getPageNumber(page.screenshotName)}: ${page.status} (Mismatch: ${page.mismatchPercentage}%)`));
                    });
                });
                
                // Format the results for JSON output
                const formattedResults = {
                    status: response.status,
                    data: {
                        buildId: response.data.buildId,
                        buildName: response.data.buildName,
                        projectName: response.data.projectName,
                        buildStatus: response.data.buildStatus,
                        pdfs: formatPdfsForOutput(pdfGroups)
                    }
                };
                
                // Save results to file if filename provided
                const filename = typeof ctx.options.fetchResults === 'string' 
                    ? ctx.options.fetchResults 
                    : 'pdf-results.json';
                
                fs.writeFileSync(filename, JSON.stringify(formattedResults, null, 2));
                console.log(chalk.green(`\nResults saved to ${filename}`));
                
                return;
            } else if (response.status === 'error') {
                // Handle API error response
                clearInterval(interval);
                console.log(chalk.red(`\nError fetching results: ${response.message || 'Unknown error'}`));
                return;
            } else {
                // If we get a response but it's not complete yet
                process.stdout.write(chalk.yellow('.'));
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.log(chalk.red('\nTimeout: Could not fetch PDF results after 5 minutes'));
                return;
            }
            
        } catch (error: any) {
            // Log the error but continue polling unless max attempts reached
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
    }, 10000); // Poll every 10 seconds
}

// Helper function to group screenshots by PDF name
function groupScreenshotsByPdf(screenshots: any[]): Record<string, any[]> {
    const pdfGroups: Record<string, any[]> = {};
    
    screenshots.forEach(screenshot => {
        // Extract PDF name from screenshot name (format: "pdfname.pdf#pagenumber")
        const pdfName = screenshot.screenshotName.split('#')[0];
        
        if (!pdfGroups[pdfName]) {
            pdfGroups[pdfName] = [];
        }
        
        pdfGroups[pdfName].push(screenshot);
    });
    
    return pdfGroups;
}

// Helper function to count PDFs with mismatches
function countPdfsWithMismatches(pdfGroups: Record<string, any[]>): number {
    let count = 0;
    
    Object.values(pdfGroups).forEach(pages => {
        if (pages.some(page => page.mismatchPercentage > 0)) {
            count++;
        }
    });
    
    return count;
}

// Helper function to count pages with mismatches
function countPagesWithMismatches(screenshots: any[]): number {
    return screenshots.filter(screenshot => screenshot.mismatchPercentage > 0).length;
}

// Helper function to extract page number from screenshot name
function getPageNumber(screenshotName: string): string {
    const parts = screenshotName.split('#');
    return parts.length > 1 ? parts[1] : '1';
}

// Helper function to format PDFs for JSON output
function formatPdfsForOutput(pdfGroups: Record<string, any[]>): any[] {
    return Object.entries(pdfGroups).map(([pdfName, pages]) => {
        return {
            pdfName,
            pageCount: pages.length,
            pages: pages.map(page => ({
                pageNumber: getPageNumber(page.screenshotName),
                screenshotId: page.screenshotId,
                mismatchPercentage: page.mismatchPercentage,
                threshold: page.threshold,
                status: page.status,
                screenshotUrl: page.screenshotUrl
            }))
        };
    });
}



