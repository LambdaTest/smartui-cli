import { Browser } from "@playwright/test"
import { Context } from "../types.js"
import { delDir, scrollToBottomAndBackToTop, launchBrowsers, closeBrowsers } from "./utils.js"
import constants from './constants.js'
import chalk from 'chalk';


export async function  captureScreenshots(ctx: Context): Promise<number> {
    // Clean up directory to store screenshots
    delDir('screenshots');

    let browsers: Record<string,Browser> = {};
    let capturedScreenshots: number = 0;
    let pageOptions = { waitUntil: process.env.SMARTUI_PAGE_WAIT_UNTIL_EVENT || 'load' };
    let totalScreenshots: number = ctx.webStaticConfig.length * 
        (((ctx.config.web?.browsers?.length * ctx.config.web?.viewports?.length) || 0) + (ctx.config.mobile?.devices?.length || 0));

    try {
        browsers = await launchBrowsers(ctx);

        for (let staticConfig of ctx.webStaticConfig) {
            let screenshotId = staticConfig.name.toLowerCase().replace(/\s/g, '_');

            // capture screenshots for web config
            if (ctx.config.web) {
                for (let browserName of ctx.config.web.browsers) {
                    const browser: Browser = browsers[browserName];
                    const context = await browser.newContext();
                    const page = await context.newPage();

                    await page.goto(staticConfig.url.trim(), pageOptions);
                    for (let { width, height } of ctx.config.web.viewports) {
                        let ssPath = `screenshots/${screenshotId}/${browserName}-${width}x${height}-${screenshotId}.png`;
                        await page.setViewportSize({ width, height: height || constants.MIN_VIEWPORT_HEIGHT });
                        if (height === 0) await page.evaluate(scrollToBottomAndBackToTop);
                        await page.waitForTimeout(staticConfig.waitForTimeout || 0);
                        await page.screenshot({ path: ssPath, fullPage: height ? false: true });

                        browserName = browserName === constants.SAFARI ? constants.PW_WEBKIT : browserName;
                        await ctx.client.uploadScreenshot(ctx.build, ssPath, staticConfig.name, browserName, `${width}${height ? `x${height}` : ``}`, ctx.log);
                        capturedScreenshots++;

                        ctx.task.output = chalk.gray(`screenshots captured: ${capturedScreenshots}/${totalScreenshots}`);
                    }

                    await page.close();
                    await context.close();
                }
            }

            // capture screenshots for mobile config
            if (ctx.config.mobile) {
                let contextChrome = await browsers[constants.CHROME]?.newContext();
                let contextSafari = await browsers[constants.SAFARI]?.newContext();
                let pageChrome = await contextChrome?.newPage();
                let pageSafari = await contextSafari?.newPage();

                await pageChrome?.goto(staticConfig.url.trim(), pageOptions);
                await pageSafari?.goto(staticConfig.url.trim(), pageOptions);
                for (let device of ctx.config.mobile.devices) {
                    let ssPath = `screenshots/${screenshotId}/${device.replace(/\s/g, '_')}_${screenshotId}.png`;
                    let { width, height } = constants.SUPPORTED_MOBILE_DEVICES[device].viewport;
                    let portrait = (ctx.config.mobile.orientation === constants.MOBILE_ORIENTATION_PORTRAIT) ? true : false;

                    if (constants.SUPPORTED_MOBILE_DEVICES[device].os === constants.MOBILE_OS_ANDROID) {
                        await pageChrome?.setViewportSize({ width: portrait ? width : height, height: portrait ? height : width });
                        if (ctx.config.mobile.fullPage) await pageChrome?.evaluate(scrollToBottomAndBackToTop);
                        await pageChrome?.waitForTimeout(staticConfig.waitForTimeout || 0);
                        await pageChrome?.screenshot({ path: ssPath, fullPage: ctx.config.mobile.fullPage });
                        await ctx.client.uploadScreenshot(ctx.build, ssPath, staticConfig.name, constants.CHROME, `${device} (${ctx.config.mobile.orientation})`, ctx.log);
                    } else {
                        await pageSafari?.setViewportSize({ width: portrait ? width : height, height: portrait ? height : width });
                        if (ctx.config.mobile.fullPage) await pageChrome?.evaluate(scrollToBottomAndBackToTop);
                        await pageSafari?.waitForTimeout(staticConfig.waitForTimeout || 0);
                        await pageSafari?.screenshot({ path: ssPath, fullPage: ctx.config.mobile.fullPage });
                        await ctx.client.uploadScreenshot(ctx.build, ssPath, staticConfig.name, constants.PW_WEBKIT, `${device} (${ctx.config.mobile.orientation})`, ctx.log);
                    }

                    capturedScreenshots++;
                    ctx.task.output = chalk.gray(`screenshots captured: ${capturedScreenshots}/${totalScreenshots}`);
                }

                await pageChrome?.close();
                await pageSafari?.close();
                await contextChrome?.close();
                await contextSafari?.close();
            }
        }

        await closeBrowsers(browsers);
        delDir('screenshots');
    } catch (error) {
        await closeBrowsers(browsers);
        delDir('screenshots');
        throw error;
    }

    return capturedScreenshots;
}