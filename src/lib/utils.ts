import fs from 'fs'
import { Context } from '../types.js'
import { chromium, firefox, webkit, Browser } from '@playwright/test'
import constants from './constants.js';

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
    let launchOptions: Record<string, any> = { headless: true };

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