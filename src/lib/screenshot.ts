import fs from 'fs';
import path from 'path';
import { Browser, BrowserContext, Page } from "@playwright/test"
import { Context } from "../types.js"
import * as utils from "./utils.js"
import constants from './constants.js'
import chalk from 'chalk';

async function captureScreenshotsForConfig(
    ctx: Context,
    browsers: Record<string, Browser>,
    {name, url, waitForTimeout}: Record<string, any>, 
    browserName: string,
    renderViewports: Array<Record<string,any>>
): Promise<void> {
    let pageOptions = { waitUntil: process.env.SMARTUI_PAGE_WAIT_UNTIL_EVENT || 'load' };
    let ssId = name.toLowerCase().replace(/\s/g, '_');
    let context: BrowserContext;
    let contextOptions: Record<string, any> = {};
    let page: Page;
    if (browserName == constants.CHROME) contextOptions.userAgent = constants.CHROME_USER_AGENT;
    else if (browserName == constants.FIREFOX) contextOptions.userAgent = constants.FIREFOX_USER_AGENT;
    else if (browserName == constants.SAFARI) contextOptions.userAgent = constants.SAFARI_USER_AGENT;
    else if (browserName == constants.EDGE) contextOptions.userAgent = constants.EDGE_USER_AGENT;

    try {
        const browser = browsers[browserName];
        context = await browser?.newContext(contextOptions);
        page = await context?.newPage();

        await page?.goto(url.trim(), pageOptions);
        for (let { viewport, viewportString, fullPage } of renderViewports) {
            let ssPath = `screenshots/${ssId}/${`${browserName}-${viewport.width}x${viewport.height}`}-${ssId}.png`;
            await page?.setViewportSize({ width: viewport.width, height: viewport.height || constants.MIN_VIEWPORT_HEIGHT });
            if (fullPage) await page?.evaluate(utils.scrollToBottomAndBackToTop);
            await page?.waitForTimeout(waitForTimeout || 0);
            await page?.screenshot({ path: ssPath, fullPage });

            await ctx.client.uploadScreenshot(ctx.build, ssPath, name, browserName, viewportString, ctx.log);
        }
    } catch (error) {
        throw new Error(`captureScreenshotsForConfig failed for browser ${browserName}; error: ${error}`);
    } finally {
        await page?.close();
        await context?.close();
    }
    
}

async function captureScreenshotsAsync(
    ctx: Context,
    staticConfig: Record<string, any>,
    browsers: Record<string, Browser>
): Promise<void[]> {
    let capturePromises: Array<Promise<void>> = [];

     // capture screenshots for web config
     if (ctx.config.web) {
        for (let browserName of ctx.config.web.browsers) {
            let webRenderViewports = utils.getWebRenderViewports(ctx);
            capturePromises.push(captureScreenshotsForConfig(ctx, browsers, staticConfig, browserName, webRenderViewports))
        }
    }
    // capture screenshots for mobile config
    if (ctx.config.mobile) {
        let mobileRenderViewports = utils.getMobileRenderViewports(ctx);
        if (mobileRenderViewports[constants.MOBILE_OS_IOS].length) {
            capturePromises.push(captureScreenshotsForConfig(ctx, browsers, staticConfig, constants.SAFARI, mobileRenderViewports[constants.MOBILE_OS_IOS]))
        }
        if (mobileRenderViewports[constants.MOBILE_OS_ANDROID].length) {
            capturePromises.push(captureScreenshotsForConfig(ctx, browsers, staticConfig, constants.CHROME, mobileRenderViewports[constants.MOBILE_OS_ANDROID]))
        }
    }

    return Promise.all(capturePromises);
}

async function captureScreenshotsSync(
    ctx: Context,
    staticConfig: Record<string, any>,
    browsers: Record<string, Browser>
): Promise<void> {
     // capture screenshots for web config
     if (ctx.config.web) {
        for (let browserName of ctx.config.web.browsers) {
            let webRenderViewports = utils.getWebRenderViewports(ctx);
            await captureScreenshotsForConfig(ctx, browsers, staticConfig, browserName, webRenderViewports);
        }
    }
    // capture screenshots for mobile config
    if (ctx.config.mobile) {
        let mobileRenderViewports = utils.getMobileRenderViewports(ctx);
        if (mobileRenderViewports[constants.MOBILE_OS_IOS].length) {
            await captureScreenshotsForConfig(ctx, browsers, staticConfig, constants.SAFARI, mobileRenderViewports[constants.MOBILE_OS_IOS]);
        }
        if (mobileRenderViewports[constants.MOBILE_OS_ANDROID].length) {
            await captureScreenshotsForConfig(ctx, browsers, staticConfig, constants.CHROME, mobileRenderViewports[constants.MOBILE_OS_ANDROID]);
        }
    }
}

export async function  captureScreenshots(ctx: Context): Promise<Record<string,any>> {
    // Clean up directory to store screenshots
    utils.delDir('screenshots');

    let browsers: Record<string,Browser> = {};
    let capturedScreenshots: number = 0;
    let output: string = '';

    try {
        browsers = await utils.launchBrowsers(ctx);
    } catch (error) {
        await utils.closeBrowsers(browsers);
        ctx.log.debug(error)
        throw new Error(`Failed launching browsers`);
    }

    for (let staticConfig of ctx.webStaticConfig) {
        try {
            if (ctx.options.parallel) await captureScreenshotsAsync(ctx, staticConfig, browsers);
            else await captureScreenshotsSync(ctx, staticConfig, browsers);

            utils.delDir(`screenshots/${staticConfig.name.toLowerCase().replace(/\s/g, '_')}`);
            output += (`${chalk.gray(staticConfig.name)} ${chalk.green('\u{2713}')}\n`);
            ctx.task.output = output;
            capturedScreenshots++;
        } catch (error) {
            ctx.log.debug(`screenshot capture failed for ${JSON.stringify(staticConfig)}; error: ${error}`);
            output += `${chalk.gray(staticConfig.name)} ${chalk.red('\u{2717}')}\n`;
            ctx.task.output = output;
        }
    }

    await utils.closeBrowsers(browsers);
    utils.delDir('screenshots');

    return { capturedScreenshots, output };
}

function getImageDimensions(filePath: string): { width: number, height: number } | null {
    const buffer = fs.readFileSync(filePath);
    let width, height;

    if (buffer.toString('hex', 0, 2) === 'ffd8') {
        // JPEG
        let offset = 2;
        while (offset < buffer.length) {
            const marker = buffer.toString('hex', offset, offset + 2);
            offset += 2;
            const length = buffer.readUInt16BE(offset);
            if (marker === 'ffc0' || marker === 'ffc2') {
                height = buffer.readUInt16BE(offset + 3);
                width = buffer.readUInt16BE(offset + 5);
                return { width, height };
            }
            offset += length;
        }
    } else if (buffer.toString('hex', 1, 4) === '504e47') {
        // PNG
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
        return { width, height };
    }

    return null;
}

function isImage(buffer: Buffer): boolean {

    return constants.MAGIC_NUMBERS.some(magic => buffer.slice(0, magic.magic.length).equals(magic.magic));
}

export async function uploadScreenshots(ctx: Context): Promise<void> {
    const allowedExtensions = ctx.options.fileExtension.map(ext => `.${ext.trim().toLowerCase()}`);
    let noOfScreenshots = 0;

    async function processDirectory(directory: string, relativePath: string = ''): Promise<void> {
        const files = fs.readdirSync(directory);

        for (let file of files) {
            const filePath = path.join(directory, file);
            const stat = fs.statSync(filePath);
            const relativeFilePath = path.join(relativePath, file);

            if (stat.isDirectory() && ctx.options.ignorePattern.includes(relativeFilePath)) {
                ctx.log.debug(`Ignoring Directory ${relativeFilePath}`)
                continue; // Skip this path
            }

            if (stat.isDirectory()) {
                await processDirectory(filePath, relativeFilePath); // Recursively process subdirectory
            } else {
                let fileExtension = path.extname(file).toLowerCase();
                if (allowedExtensions.includes(fileExtension)) {
                    const fileBuffer = fs.readFileSync(filePath);

                    if (!isImage(fileBuffer)) {
                        ctx.log.debug(`File ${filePath} is not a valid ${fileExtension} image. Skipping.`);
                        continue;
                    }

                    let ssId = relativeFilePath;
                    if (ctx.options.stripExtension) {
                        ssId = path.join(relativePath, path.basename(file, fileExtension));
                    }

                    let viewport = 'default';

                    if (!ctx.options.ignoreResolutions) {
                        const dimensions = getImageDimensions(filePath);
                        if (!dimensions) {
                            ctx.log.debug(`Unable to determine dimensions for image: ${filePath}`)
                        } else {
                            const width = dimensions.width;
                            const height = dimensions.height;
                            viewport = `${width}x${height}`;
                        }
                    }

                    await ctx.client.uploadScreenshot(ctx.build, filePath, ssId, 'default', viewport, ctx.log);
                    ctx.log.debug(`${filePath} : uploaded successfully`)
                    noOfScreenshots++;
                }
            }
        }
    }

    await processDirectory(ctx.uploadFilePath);
    if(noOfScreenshots == 0){
        console.log(`No screenshots uploaded.`);
    } else {
    console.log(`${noOfScreenshots} screenshots uploaded successfully.`);
    }
}
