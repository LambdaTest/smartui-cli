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
    let page: Page;

    try {
        const browser = browsers[browserName];
        context = await browser?.newContext();
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