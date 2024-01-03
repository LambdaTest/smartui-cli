import { chromium, firefox, webkit, Browser } from "@playwright/test"
import { Context, WebStaticConfig } from "../types.js"
import { delDir } from "./utils.js"

const BROWSER_CHROME = 'chrome';
const BROWSER_SAFARI = 'safari';
const BROWSER_FIREFOX = 'firefox';
const BROWSER_EDGE = 'edge';
const EDGE_CHANNEL = 'msedge';
const PW_WEBKIT = 'webkit';

export async function captureScreenshots(ctx: Context, screenshots: WebStaticConfig): Promise<number> {
    // Clean up directory to store screenshots
    delDir('screenshots');

    // Capture screenshots for every browser-viewport and upload them
    let totalBrowsers: number = ctx.webConfig.browsers.length;
    let totalViewports: number = ctx.webConfig.viewports.length;
    let totalScreenshots: number = screenshots.length
    for (let i = 0; i < totalBrowsers; i++) {
        let browserName = ctx.webConfig.browsers[i]?.toLowerCase();
        let browser: Browser;
        let launchOptions: Record<string, any> = { headless: true };
        let pageOptions = { waitUntil: process.env.SMARTUI_PAGE_WAIT_UNTIL_EVENT || 'load' }

        try {
            switch (browserName) {
                case BROWSER_CHROME:
                    browser = await chromium.launch(launchOptions)
                    break;
                case BROWSER_SAFARI:
                    browser = await webkit.launch(launchOptions)
                    break;
                case BROWSER_FIREFOX:
                    browser = await firefox.launch(launchOptions)
                    break;
                case BROWSER_EDGE:
                    launchOptions.channel = EDGE_CHANNEL
                    browser = await chromium.launch(launchOptions)
                    break;
            }
            const context = await browser.newContext();

            for (let j = 0; j < totalScreenshots; j++) {
                let screenshot = screenshots[j]
                let screenshotId = screenshot.name.toLowerCase().replace(/\s/g, '-');

                const page = await context.newPage();
                await page.goto(screenshot.url, pageOptions);
                await page.waitForTimeout(screenshot.waitForTimeout || 0)

                for (let k = 0; k < totalViewports; k++) {
                    let { width, height } = ctx.webConfig.viewports[k];
                    let ssName = `${browserName}-${width}x${height}-${screenshotId}.png`
                    let ssPath = `screenshots/${screenshotId}/${ssName}.png`
                    await page.setViewportSize({ width, height})
                    await page.screenshot({ path: ssPath });

                    let completed = (i == (totalBrowsers-1) && j == (totalScreenshots-1) && k == (totalViewports-1)) ? true : false;
                    browserName = browserName === BROWSER_SAFARI ? PW_WEBKIT : browserName;
                    ctx.client.uploadScreenshot(ctx.build, ssPath, screenshot.name, browserName, `${width}x${height}`, completed);
                }

                await page.close();
            }

            await browser.close();
        } catch (error) {
            if (browser) await browser.close();
            throw error;
        }
    }

    return totalBrowsers * totalViewports * totalScreenshots
}