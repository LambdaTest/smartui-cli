import fs from 'fs';
import path from 'path';
import { Browser, BrowserContext, Page } from "@playwright/test"
import { Context, DiscoveryErrors } from "../types.js"
import * as utils from "./utils.js"
import constants from './constants.js'
import chalk from 'chalk';
import sharp from 'sharp';

async function getMaxPageHeight(page: Page): Promise<number> {
    return await page.evaluate(() => {
        return Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );
    });
}

async function humanLikeScroll(page: Page) {
  // Move mouse in human like manner
  await page.waitForTimeout(2000);
  await page.mouse.move(100, 100);
  await page.waitForTimeout(300);
  await page.mouse.move(300, 200);
  await page.waitForTimeout(300);
  await page.mouse.move(500, 300);
  await page.waitForTimeout(2000);
}

async function captureScreenshotsForConfig(
    ctx: Context,
    browsers: Record<string, Browser>,
    urlConfig: Record<string, any>,
    browserName: string,
    renderViewports: Array<Record<string, any>>
): Promise<void> {
    ctx.log.debug(`*** urlConfig  ${JSON.stringify(urlConfig)}`);

    let {name, url, waitForTimeout, execute, pageEvent, userAgent} = urlConfig;
    let beforeNavigationScript = execute?.beforeNavigation;
    let afterNavigationScript = execute?.afterNavigation;
    let beforeSnapshotScript = execute?.beforeSnapshot;
    let waitUntilEvent = pageEvent || process.env.SMARTUI_PAGE_WAIT_UNTIL_EVENT || 'load';

    let discoveryErrors: DiscoveryErrors = {
        name: "",
        url: "",
        timestamp: "",
        snapshotUUID: "",
        browsers: {}
    };

    let globalViewport = ""
    let globalBrowser = constants.CHROME

    let pageOptions = { waitUntil: waitUntilEvent, timeout: ctx.config.waitForPageRender || constants.DEFAULT_PAGE_LOAD_TIMEOUT };
    ctx.log.debug(`url:  ${url}  pageOptions: ${JSON.stringify(pageOptions)}`);
    let ssId = name.toLowerCase().replace(/\s/g, '_');
    let context: BrowserContext;
    let contextOptions: Record<string, any> = {
        ignoreHTTPSErrors: ctx.config.ignoreHTTPSErrors
    };



    // Resolve proxy/tunnel/geolocation-proxy from global config
    try {
        if (ctx.config.tunnel && ctx.config.tunnel.tunnelName) {
            if (ctx.tunnelDetails && ctx.tunnelDetails.tunnelPort != -1 && ctx.tunnelDetails.tunnelHost) {
                const tunnelServer = `http://${ctx.tunnelDetails.tunnelHost}:${ctx.tunnelDetails.tunnelPort}`;
                ctx.log.info(`URL Capture :: Using tunnel address: ${tunnelServer}`);
                contextOptions.proxy = { server: tunnelServer };
            } else {
                let tunnelResp = await ctx.client.getTunnelDetails(ctx, ctx.log);
                ctx.log.debug(`Tunnel Response: ${JSON.stringify(tunnelResp)}`)
                if (tunnelResp && tunnelResp.data && tunnelResp.data.host && tunnelResp.data.port) {
                    ctx.tunnelDetails = {
                        tunnelHost: tunnelResp.data.host,
                        tunnelPort: tunnelResp.data.port,
                        tunnelName: tunnelResp.data.tunnel_name
                    } as any;
                    const tunnelServer = `http://${ctx.tunnelDetails.tunnelHost}:${ctx.tunnelDetails.tunnelPort}`;
                    ctx.log.info(`URL Capture :: Using tunnel address: ${tunnelServer}`);
                    contextOptions.proxy = { server: tunnelServer };
                } else if (tunnelResp && tunnelResp.error) {
                    if (tunnelResp.error.message) {
                        ctx.log.warn(`Error while fetching tunnel details: ${tunnelResp.error.message}`)
                    }
                }
            }
        } else if (ctx.config.geolocation && ctx.config.geolocation !== '') {
            // Use cached geolocation proxy if available for the same geolocation key
            if (ctx.geolocationData && ctx.geolocationData.proxy && ctx.geolocationData.username && ctx.geolocationData.password && ctx.geolocationData.geoCode === ctx.config.geolocation) {
                ctx.log.info(`URL Capture :: Using cached geolocation proxy for ${ctx.config.geolocation}`);
                contextOptions.proxy = {
                    server: ctx.geolocationData.proxy,
                    username: ctx.geolocationData.username,
                    password: ctx.geolocationData.password
                };
            } else {
                const geoResp = await ctx.client.getGeolocationProxy(ctx.config.geolocation, ctx.log);
                ctx.log.debug(`Geolocation proxy response: ${JSON.stringify(geoResp)}`);
            if (geoResp && geoResp.data && geoResp.data.proxy && geoResp.data.username && geoResp.data.password) {
                ctx.log.info(`URL Capture :: Using geolocation proxy for ${ctx.config.geolocation}`);
                    ctx.geolocationData = {
                        proxy: geoResp.data.proxy,
                        username: geoResp.data.username,
                        password: geoResp.data.password,
                        geoCode: ctx.config.geolocation
                    } as any;
                contextOptions.proxy = {
                    server: geoResp.data.proxy,
                    username: geoResp.data.username,
                    password: geoResp.data.password
                };
            } else {
                ctx.log.warn(`Geolocation proxy not available for '${ctx.config.geolocation}', falling back if dedicatedProxyURL present`);
                if (ctx.config.dedicatedProxyURL && ctx.config.dedicatedProxyURL !== '') {
                    ctx.log.info(`URL Capture :: Using dedicated proxy: ${ctx.config.dedicatedProxyURL}`);
                    contextOptions.proxy = { server: ctx.config.dedicatedProxyURL };
                }
            }
            }
        } else if (ctx.config.dedicatedProxyURL && ctx.config.dedicatedProxyURL !== '') {
            ctx.log.info(`URL Capture :: Using dedicated proxy: ${ctx.config.dedicatedProxyURL}`);
            contextOptions.proxy = { server: ctx.config.dedicatedProxyURL };
        }

        // Note: when using IP-based geolocation via proxy, browser geolocation permission is not required
        
    } catch (e) {
        ctx.log.debug(`Failed resolving tunnel/proxy details: ${e}`);
    }
    let page: Page;
    if (!ctx.env.DO_NOT_USE_USER_AGENT) {
      if (browserName == constants.CHROME)
        contextOptions.userAgent = constants.CHROME_USER_AGENT;
      else if (browserName == constants.FIREFOX)
        contextOptions.userAgent = constants.FIREFOX_USER_AGENT;
      else if (browserName == constants.SAFARI)
        contextOptions.userAgent = constants.SAFARI_USER_AGENT;
      else if (browserName == constants.EDGE)
        contextOptions.userAgent = constants.EDGE_USER_AGENT;
      if (ctx.config.userAgent || userAgent) {
        if (ctx.config.userAgent !== "") {
          contextOptions.userAgent = ctx.config.userAgent;
        }
        if (userAgent && userAgent !== "") {
          contextOptions.userAgent = userAgent;
        }
      }
    }

    try {
        const browser = browsers[browserName];
        context = await browser?.newContext(contextOptions);
        page = await context?.newPage();

        if (beforeNavigationScript && beforeNavigationScript !== "") {
            const wrappedScript = new Function('page', `
                return (async () => {
                    ${beforeNavigationScript}
                })();
            `);
            ctx.log.debug(`Executing before navigation script: ${wrappedScript}`);
            await wrappedScript(page);
        }
        const headersObject: Record<string, string> = {};
        // Headless Chromium leaks "HeadlessChrome" into the Sec-CH-UA client hint, which bot-protection
        // WAFs (e.g. Akamai) block on. Seed a clean Sec-CH-UA for Chromium engines only — WebKit/Firefox
        // don't send client hints, so setting them there would itself be a bot tell. User-supplied
        // requestHeaders below still override these defaults.
        if (utils.isChromiumEngine(browserName)) {
            Object.assign(headersObject, constants.REQUEST_HEADERS);
        }
        if (ctx.config.requestHeaders && Array.isArray(ctx.config.requestHeaders)) {
            ctx.config.requestHeaders.forEach((headerObj) => {
                Object.entries(headerObj).forEach(([key, value]) => {
                    headersObject[key] = value;
                });
            });
        }
        if (urlConfig.requestHeaders && Array.isArray(urlConfig.requestHeaders)) {
            urlConfig.requestHeaders.forEach((headerObj) => {
                Object.entries(headerObj).forEach(([key, value]) => {
                    headersObject[key] = value;
                });
            });
        }

        ctx.log.debug(`Combined headers: ${JSON.stringify(headersObject)}`);
        if (Object.keys(headersObject).length > 0) {
            await page.setExtraHTTPHeaders(headersObject);
        }

        const targetHostname = new URL(url).hostname;

        if (ctx.env.CAPTURE_RENDERING_ERRORS) {
            await page.route('**/*', async (route, request) => {
                const requestUrl = request.url()
                const requestHostname = new URL(requestUrl).hostname;
                let requestOptions: Record<string, any> = {
                    timeout: 30000,
                    headers: {
                        ...await request.allHeaders(),
                        ...constants.REQUEST_HEADERS
                    }
                }

                // Add basic authorization only for same-origin requests
                if (ctx.config.basicAuthorization && requestHostname === targetHostname) {
                    let token = Buffer.from(`${ctx.config.basicAuthorization.username}:${ctx.config.basicAuthorization.password}`).toString('base64');
                    requestOptions.headers['Authorization'] = `Basic ${token}`;
                }

                try {

                    // get response
                    let response, body;
                    response = await page.request.fetch(request, requestOptions);
                    body = await response.body();

                    let data = {
                        statusCode: `${response.status()}`,
                        url: requestUrl,
                    }

                    if ((response.status() >= 400 && response.status() < 600) && response.status() !== 0) {
                        if (!discoveryErrors.browsers[globalBrowser]) {
                            discoveryErrors.browsers[globalBrowser] = {};
                        }

                        // Check if the discoveryErrors.browsers[globalBrowser] exists, and if not, initialize it
                        if (discoveryErrors.browsers[globalBrowser] && !discoveryErrors.browsers[globalBrowser][globalViewport]) {
                            discoveryErrors.browsers[globalBrowser][globalViewport] = [];
                        }

                        // Dynamically push the data into the correct browser and viewport
                        if (discoveryErrors.browsers[globalBrowser]) {
                            discoveryErrors.browsers[globalBrowser][globalViewport]?.push(data as any);
                        }

                        ctx.build.hasDiscoveryError = true;
                    }

                    // Continue the request with the fetched response
                    route.fulfill({
                        status: response.status(),
                        headers: response.headers(),
                        body: body,
                    });
                } catch (error: any) {
                    ctx.log.debug(`Handling request ${requestUrl}\n - aborted due to ${error.message}`);
                    route.abort();
                }
            });
        } else if (ctx.config.basicAuthorization) {
            // Intercept only when basic auth is configured, to scope it to same-origin requests
            await page.route('**/*', async (route, request) => {
                const requestHostname = new URL(request.url()).hostname;
                if (requestHostname === targetHostname) {
                    let token = Buffer.from(`${ctx.config.basicAuthorization.username}:${ctx.config.basicAuthorization.password}`).toString('base64');
                    await route.continue({ headers: { ...await request.allHeaders(), 'Authorization': `Basic ${token}` } });
                } else {
                    await route.continue();
                }
            });
        }

        // WebKit only: Linux Playwright WebKit can't decode AVIF, so the site's AVIF images render
        // blank. Reject avif/webp on image requests so the origin serves JPEG/PNG. Registered last so
        // it runs first, then defers (fallback) to any handler above (CAPTURE_RENDERING_ERRORS /
        // basicAuth) or to the network.
        if (utils.isWebkitEngine(browserName)) {
            await page.route('**/*', async (route, request) => {
                const overrides = request.resourceType() === 'image'
                    ? { headers: { ...await request.allHeaders(), accept: constants.WEBKIT_IMAGE_ACCEPT } }
                    : {};
                await route.fallback(overrides);
            });
        }

        if (renderViewports && renderViewports.length > 0) {
            const first = renderViewports[0];
            globalViewport = first.viewportString;
            globalBrowser = browserName;
            if (globalViewport.toLowerCase().includes("iphone") || globalViewport.toLowerCase().includes("ipad")) {
                globalBrowser = constants.WEBKIT;
            }
        }

        if (browserName == constants.SAFARI || (globalViewport.toLowerCase().includes("iphone") || globalViewport.toLowerCase().includes("ipad"))) {
            globalBrowser = constants.WEBKIT;
        }

        await page?.goto(url.trim(), pageOptions);
        await executeDocumentScripts(ctx, page, "afterNavigation", afterNavigationScript)

        let viewportErrors: Array<{ viewportString: string, error: any }> = [];

        for (let { viewport, viewportString, fullPage } of renderViewports) {
            try {
                globalViewport = viewportString;
                globalBrowser = browserName
                ctx.log.debug(`globalViewport : ${globalViewport}`);
                if (browserName == constants.SAFARI || (globalViewport.toLowerCase().includes("iphone") || globalViewport.toLowerCase().includes("ipad"))) {
                    globalBrowser = constants.WEBKIT;
                }
                let ssPath = `screenshots/${ssId}/${`${browserName}-${viewport.width}x${viewport.height}`}-${ssId}.png`;
                await page?.setViewportSize({ width: viewport.width, height: viewport.height || constants.MIN_VIEWPORT_HEIGHT });
                // again load page to apply viewport size properly
                await page?.goto(url.trim(), pageOptions);
                ctx.log.debug(`Capturing screenshot for URL: ${url} on ${browserName} with viewport: ${viewportString} (fullPage: ${fullPage})`);
                if (page && ctx.config.lazyLoadConfiguration) {
                    await humanLikeScroll(page);
                }
                if (fullPage) {
                    if (ctx.config.lazyLoadConfiguration && ctx.config.lazyLoadConfiguration.enabled) {
                        let stepValue = ctx.config.lazyLoadConfiguration.scrollStep || 250;
                        let delayValue = ctx.config.lazyLoadConfiguration.scrollDelay || 300;
                        let maxScrollsValue = ctx.config.lazyLoadConfiguration.maxScrolls || 50;
                        let jumpBackToTopValue = ctx.config.lazyLoadConfiguration.jumpBackToTop !== false;
                        ctx.log.debug('Capture: Starting lazy load scrolling with configuration: ' + JSON.stringify({ step: stepValue, delay: delayValue, maxScrolls: maxScrollsValue, jumpBackToTop: jumpBackToTopValue }));
                        await page?.evaluate(utils.smoothScrollToBottom, { step: stepValue, delay: delayValue, maxScrolls: maxScrollsValue, jumpBackToTop: jumpBackToTopValue });
                        ctx.log.debug('Capture: Completed lazy load scrolling');
                    } else {
                        await page?.evaluate(utils.scrollToBottomAndBackToTop, { frequency: 100, timing: ctx.config.scrollTime });
                    }
                }
                await page?.waitForTimeout(waitForTimeout || 0);
                await executeDocumentScripts(ctx, page, "beforeSnapshot", beforeSnapshotScript)

                discoveryErrors.name = name;
                discoveryErrors.url = url;
                discoveryErrors.timestamp = new Date().toISOString();

                // Try full-page screenshot first; if it fails due to the software-rendering
                // texture limit on headless Linux (32767px), retry with capped height.
                try {
                    await page?.screenshot({ path: ssPath, fullPage });
                } catch (screenshotError: any) {
                    const isTextureLimitError = screenshotError?.message?.includes(constants.SCREENSHOT_TOO_LARGE_ERROR);
                    if (fullPage && page && isTextureLimitError) {
                        const maxPageHeight = await getMaxPageHeight(page);
                        ctx.log.warn(`${ssId} - Full-page screenshot failed for ${browserName} at viewport ${viewportString} (page height: ${maxPageHeight}px). Retrying with capped height ${constants.MAXIMUM_POSSIBLE_PAGE_HEIGHT}px.`);
                        await page.setViewportSize({
                            width: viewport.width,
                            height: constants.MAXIMUM_POSSIBLE_PAGE_HEIGHT
                        });
                        await page.screenshot({ path: ssPath, fullPage: false });
                    } else {
                        throw screenshotError;
                    }
                }

                await ctx.client.uploadScreenshot(ctx.build, ssPath, name, browserName, viewportString, url, ctx.log, discoveryErrors, ctx);
                discoveryErrors = {
                    name: "",
                    url: "",
                    timestamp: "",
                    snapshotUUID: "",
                    browsers: {}
                };
            } catch (viewportError) {
                ctx.log.debug(`screenshot capture failed for viewport ${viewportString} on ${browserName} for URL ${url}; error: ${viewportError}`);
                viewportErrors.push({ viewportString, error: viewportError });
            }
        }

        if (viewportErrors.length === renderViewports.length) {
            throw new Error(`captureScreenshotsForConfig failed for browser ${browserName}; all viewports failed. First error: ${viewportErrors[0]?.error}`);
        } else if (viewportErrors.length > 0) {
            ctx.log.warn(`${viewportErrors.length}/${renderViewports.length} viewport(s) failed for browser ${browserName} on URL ${url}: ${viewportErrors.map(e => e.viewportString).join(', ')}`);
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
): Promise<void> {
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

    const results = await Promise.allSettled(capturePromises);
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

    if (failures.length > 0) {
        ctx.log.debug(`${failures.length}/${results.length} browser capture(s) failed for ${staticConfig.name}: ${failures.map(f => f.reason).join('; ')}`);
    }
    if (failures.length === results.length) {
        throw new Error(`All browser captures failed for ${staticConfig.name}: ${failures.map(f => f.reason).join('; ')}`);
    }
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

export async function captureScreenshots(ctx: Context): Promise<Record<string, any>> {
    // Clean up directory to store screenshots
    utils.delDir('screenshots');

    let browsers: Record<string, Browser> = {};
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
            ctx.log.debug(`captureScreenshots failed for ${JSON.stringify(staticConfig)}; error: ${error}`);
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

async function isAllowedImage(filePath: string): Promise<boolean> {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const isMagicValid = constants.MAGIC_NUMBERS.some(magic => fileBuffer.slice(0, magic.magic.length).equals(magic.magic));
        const metadata = await sharp(filePath).metadata();
        if (metadata.format === constants.FILE_EXTENSION_GIFS) {
            return false;
        }
        if (metadata.width > 0 && metadata.height > 0) {
            return true;
        }
        if (isMagicValid && metadata.format !== constants.FILE_EXTENSION_GIFS) {
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
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
                ctx.log.info(`Ignoring Directory ${relativeFilePath}`)
                continue; // Skip this path
            }

            if (stat.isDirectory()) {
                await processDirectory(filePath, relativeFilePath); // Recursively process subdirectory
            } else {
                let fileExtension = path.extname(file).toLowerCase();
                if (allowedExtensions.includes(fileExtension)) {
                    const isValid = await isAllowedImage(filePath);

                    if (!isValid) {
                        ctx.log.info(`File ${filePath} is not a valid ${fileExtension} image or is corrupted. Skipping.`);
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
                            ctx.log.info(`Unable to determine dimensions for image: ${filePath}`)
                        } else {
                            const width = dimensions.width;
                            const height = dimensions.height;
                            viewport = `${width}x${height}`;
                        }
                    }

                    await ctx.client.uploadScreenshot(ctx.build, filePath, ssId, 'default', viewport, "", ctx.log, {
                        name: "",
                        url: "",
                        timestamp: new Date().toISOString(),
                        snapshotUUID: "",
                        browsers: {}
                    }, ctx);
                    ctx.log.info(`${filePath} : uploaded successfully`)
                    noOfScreenshots++;
                } else {
                    ctx.log.info(`File ${filePath} has invalid file extension: ${fileExtension}. Skipping`)
                }
            }
        }
    }

    await processDirectory(ctx.uploadFilePath);
    if (noOfScreenshots == 0) {
        ctx.log.info(`No screenshots uploaded.`);
    } else {
        ctx.log.info(`${noOfScreenshots} screenshots uploaded successfully.`);
    }
}

export async function captureScreenshotsConcurrent(ctx: Context): Promise<Record<string, any>> {
    // Clean up directory to store screenshots
    utils.delDir('screenshots');

    let totalSnapshots = ctx.webStaticConfig && ctx.webStaticConfig.length;
    let browserInstances = ctx.options.parallel || 1;
    let optimizeBrowserInstances: number = 0
    optimizeBrowserInstances = Math.floor(Math.log2(totalSnapshots));
    if (optimizeBrowserInstances < 1) {
        optimizeBrowserInstances = 1;
    }

    if (optimizeBrowserInstances > browserInstances) {
        optimizeBrowserInstances = browserInstances;
    }

    // If force flag is set, use the requested browser instances
    if (ctx.options.force && browserInstances > 1) {
        optimizeBrowserInstances = browserInstances;
    }

    let urlsPerInstance: number = 0;
    if (optimizeBrowserInstances == 1) {
        urlsPerInstance = totalSnapshots;
    } else {
        urlsPerInstance = Math.ceil(totalSnapshots / optimizeBrowserInstances);
    }
    ctx.log.debug(`*** browserInstances requested ${ctx.options.parallel} `);
    ctx.log.debug(`*** optimizeBrowserInstances  ${optimizeBrowserInstances} `);
    ctx.log.debug(`*** urlsPerInstance  ${urlsPerInstance}`);
    ctx.task.output = `URLs : ${totalSnapshots} || Parallel Browser Instances: ${optimizeBrowserInstances}\n`;
    //Divide the URLs into chunks
    let staticURLChunks = splitURLs(ctx.webStaticConfig, urlsPerInstance);
    let totalCapturedScreenshots: number = 0;
    let output: any = '';

    const responses = await Promise.all(staticURLChunks.map(async (urlConfig) => {
        let { capturedScreenshots, finalOutput } = await processChunk(ctx, urlConfig);
        return { capturedScreenshots, finalOutput };
    }));

    responses.forEach((response: Record<string, any>) => {
        totalCapturedScreenshots += response.capturedScreenshots;
        output += response.finalOutput;
    });

    utils.delDir('screenshots');

    return { totalCapturedScreenshots, output };
}

function splitURLs(arr: any, chunkSize: number) {
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}

async function processChunk(ctx: Context, urlConfig: Array<Record<string, any>>): Promise<Record<string, any>> {

    let browsers: Record<string, Browser> = {};
    let capturedScreenshots: number = 0;
    let finalOutput: string = '';

    try {
        browsers = await utils.launchBrowsers(ctx);
    } catch (error) {
        await utils.closeBrowsers(browsers);
        ctx.log.debug(error)
        throw new Error(`Failed launching browsers ${error}`);
    }

    for (let staticConfig of urlConfig) {
        try {
            await captureScreenshotsAsync(ctx, staticConfig, browsers);

            utils.delDir(`screenshots/${staticConfig.name.toLowerCase().replace(/\s/g, '_')}`);
            let output = (`${chalk.gray(staticConfig.name)} ${chalk.green('\u{2713}')}\n`);
            ctx.task.output = ctx.task.output ? ctx.task.output + output : output;
            finalOutput += output;
            capturedScreenshots++;
        } catch (error) {
            ctx.log.debug(`screenshot capture failed for ${JSON.stringify(staticConfig)}; error: ${error}`);
            let output = `${chalk.gray(staticConfig.name)} ${chalk.red('\u{2717}')}\n`;
            ctx.task.output += output;
            finalOutput += output;
        }
    }

    await utils.closeBrowsers(browsers);
    return { capturedScreenshots, finalOutput };
}

async function executeDocumentScripts(ctx: Context, page: Page, actionType: string, script: string) {
    try {
        if (!page) {
            throw new Error("Page instance not available");
        }

        if (script !== "") {
            await page.evaluate((script) => {
                new Function(script)();
            }, script);
        }
    } catch (error) {
        ctx.log.error(`Error executing script for action ${actionType}: `, error);
        throw error;
    }
}