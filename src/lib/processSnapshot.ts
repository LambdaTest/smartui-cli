import { Snapshot, Context, DiscoveryErrors } from "../types.js";
import { scrollToBottomAndBackToTop, getRenderViewports, getRenderViewportsForOptions } from "./utils.js"
import { chromium, Locator } from "@playwright/test"
import constants from "./constants.js";
import { updateLogContext } from '../lib/logger.js'
import NodeCache from 'node-cache'; 

const globalCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const MAX_RESOURCE_SIZE = 15 * (1024 ** 2); // 15MB
var ALLOWED_RESOURCES = ['document', 'stylesheet', 'image', 'media', 'font', 'other'];
const ALLOWED_STATUSES = [200, 201];
const REQUEST_TIMEOUT = 1800000;
const MIN_VIEWPORT_HEIGHT = 1080;

export default async function processSnapshot(snapshot: Snapshot, ctx: Context): Promise<Record<string, any>> {
    updateLogContext({ task: 'discovery' });
    ctx.log.debug(`Processing snapshot ${snapshot.name} ${snapshot.url}`);
    const isHeadless = process.env.HEADLESS?.toLowerCase() === 'false' ? false : true;
    let discoveryErrors: DiscoveryErrors = {
        name: "",
        url: "",
        timestamp: "",
        snapshotUUID: "",
        browsers: {}
      };

    let globalViewport = ""
    let globalBrowser = constants.CHROME
    let launchOptions: Record<string, any> = {
        headless: isHeadless,
        args: constants.LAUNCH_ARGS
    }
    let contextOptions: Record<string, any> = {
        javaScriptEnabled: ctx.config.cliEnableJavaScript,
        userAgent: constants.CHROME_USER_AGENT,
        ignoreHTTPSErrors : ctx.config.ignoreHTTPSErrors
    }
    if (!ctx.browser?.isConnected()) {
        if (ctx.env.HTTP_PROXY || ctx.env.HTTPS_PROXY) launchOptions.proxy = { server: ctx.env.HTTP_PROXY || ctx.env.HTTPS_PROXY };
        if (ctx.env.SMARTUI_HTTP_PROXY || ctx.env.SMARTUI_HTTPS_PROXY) launchOptions.proxy = { server: ctx.env.SMARTUI_HTTP_PROXY || ctx.env.SMARTUI_HTTPS_PROXY };
        ctx.browser = await chromium.launch(launchOptions);
        ctx.log.debug(`Chromium launched with options ${JSON.stringify(launchOptions)}`);
    }
    const context = await ctx.browser.newContext(contextOptions);
    ctx.log.debug(`Browser context created with options ${JSON.stringify(contextOptions)}`);
    // Setting cookies in playwright context
    if (!ctx.env.SMARTUI_DO_NOT_USE_CAPTURED_COOKIES && snapshot.dom.cookies) {
        const domainName = new URL(snapshot.url).hostname;
        ctx.log.debug(`Setting cookies for domain: ${domainName}`);

        const cookieArray = snapshot.dom.cookies.split('; ').map(cookie => {
            if (!cookie) return null;
            const [name, value] = cookie.split('=');
            if (!name || !value) return null;

            return {
                name: name.trim(),
                value: value.trim(),
                domain: domainName,
                path: '/'
            };
        }).filter(Boolean);

        if (cookieArray.length > 0) {
            await context.addCookies(cookieArray);
        } else {
            ctx.log.debug('No valid cookies to add');
        }
    }
    const page = await context.newPage();

    // populate cache with already captured resources
    let cache: Record<string, any> = {};
    if (snapshot.dom.resources.length) {
        for (let resource of snapshot.dom.resources) {
            // convert text/css content to base64
            let body = resource.mimetype == 'text/css' ? Buffer.from(resource.content).toString('base64') : resource.content;
            cache[resource.url] = {
                body: body,
                type: resource.mimetype
            }
        }
    }

    // Use route to intercept network requests and discover resources
    await page.route('**/*', async (route, request) => {
        const requestUrl = request.url()
        const requestHostname = new URL(requestUrl).hostname;
        let requestOptions: Record<string, any> = {
            timeout: REQUEST_TIMEOUT,
            headers: {
                ...await request.allHeaders(),
                ...constants.REQUEST_HEADERS
            }
        }
        
        try {
            // abort audio/video media requests
            if (/\.(mp3|mp4|wav|ogg|webm)$/i.test(request.url())) {
                throw new Error('resource type mp3/mp4/wav/ogg/webm');
            }

            // handle discovery config
            ctx.config.allowedHostnames.push(new URL(snapshot.url).hostname);
            if (ctx.config.enableJavaScript) ALLOWED_RESOURCES.push('script');
            if (ctx.config.basicAuthorization) {
                ctx.log.debug(`Adding basic authorization to the headers for root url`);
                let token = Buffer.from(`${ctx.config.basicAuthorization.username}:${ctx.config.basicAuthorization.password}`).toString('base64');
                requestOptions.headers.Authorization = `Basic ${token}`;
            }

            // get response
            let response, body;
            if (requestUrl === snapshot.url) {
                response = {
                    status: () => 200,
                    headers: () => ({ 'content-type': 'text/html' })
                }
                body = snapshot.dom.html;
            } else if (cache[requestUrl]) {
                response = {
                    status: () => 200,
                    headers: () => ({ 'content-type': cache[requestUrl].mimetype })
                }
                body = cache[requestUrl].body;
            } else if (ctx.config.useGlobalCache && globalCache.has(requestUrl)) {
                // Resource found in the global cache
                ctx.log.debug(`Found resource ${requestUrl} in global cache`);
                response = {
                    status: () => 200,
                    headers: () => ({ 'content-type': globalCache.get(requestUrl).type })
                };
                body = globalCache.get(requestUrl).body;
            } else {
                ctx.log.debug(`Resource not found in cache or global cache ${requestUrl} fetching from server`);
                response = await page.request.fetch(request, requestOptions);
                body = await response.body();
            }

            // handle response
            if (!body) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping no response`);
            } else if (!body.length) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping empty response`);
            } else if (requestUrl === snapshot.url) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping root resource`);
            } else if (!ctx.config.allowedHostnames.includes(requestHostname)) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping remote resource`);
            } else if (cache[requestUrl]) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping already cached resource`);
            } else if (body.length > MAX_RESOURCE_SIZE) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping resource larger than 15MB`);
            } else if (!ALLOWED_RESOURCES.includes(request.resourceType())) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping disallowed resource type [${request.resourceType()}]`);
            }  else if (!ALLOWED_STATUSES.includes(response.status())) {
                ctx.log.debug(`${globalViewport} Handling request ${requestUrl}\n - skipping disallowed status [${response.status()}]`);
                let data = {
                    statusCode: `${response.status()}`,
                    url: requestUrl,
                    resourceType: request.resourceType(),
                } 

                if (!discoveryErrors.browsers[globalBrowser]){
                    discoveryErrors.browsers[globalBrowser] = {};                }

                // Check if the discoveryErrors.browsers[globalBrowser] exists, and if not, initialize it
                if (discoveryErrors.browsers[globalBrowser] && !discoveryErrors.browsers[globalBrowser][globalViewport]) {
                    discoveryErrors.browsers[globalBrowser][globalViewport] = [];
                }

                // Dynamically push the data into the correct browser and viewport
                if (discoveryErrors.browsers[globalBrowser]) {
                    discoveryErrors.browsers[globalBrowser][globalViewport]?.push(data);
                }

            } else {
                ctx.log.debug(`Handling request ${requestUrl}\n - content-type ${response.headers()['content-type']}`);
                
                if (ctx.config.useGlobalCache) {
                    globalCache.set(requestUrl, {
                        body: body.toString('base64'),
                        type: response.headers()['content-type']
                    });
                }
            
                cache[requestUrl] = {
                    body: body.toString('base64'),
                    type: response.headers()['content-type']
                }
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

    let options = snapshot.options;
    let optionWarnings: Set<string> = new Set();
    let processedOptions: Record<string, any> = {};
    let selectors: Array<string> = [];
    let ignoreOrSelectDOM: string;
    let ignoreOrSelectBoxes: string;
    if (options && Object.keys(options).length) {
        ctx.log.debug(`Snapshot options: ${JSON.stringify(options)}`);

        const isNotAllEmpty = (obj: Record<string, Array<string>>): boolean => {
            for (let key in obj) if (obj[key]?.length) return true;
            return false;
        }

        if (options.loadDomContent) {
            processedOptions.loadDomContent = true;
        }

        if (options.sessionId) {
            const sessionId = options.sessionId;
            processedOptions.sessionId = sessionId
            if (ctx.sessionCapabilitiesMap && ctx.sessionCapabilitiesMap.has(sessionId)) {
                const sessionCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
                if (sessionCapabilities && sessionCapabilities.id) {
                    processedOptions.testId = sessionCapabilities.id;
                }
            }
        }

        if (options.web && Object.keys(options.web).length) {
            processedOptions.web = {};
        
            // Check and process viewports in web
            if (options.web.viewports && options.web.viewports.length > 0) {
                processedOptions.web.viewports = options.web.viewports.filter(viewport => 
                    Array.isArray(viewport) && viewport.length > 0
                );
            }
        
            // Check and process browsers in web
            if (options.web.browsers && options.web.browsers.length > 0) {
                processedOptions.web.browsers = options.web.browsers;
            }
        }

        if (options.mobile && Object.keys(options.mobile).length) {
            processedOptions.mobile = {};
        
            // Check and process devices in mobile
            if (options.mobile.devices && options.mobile.devices.length > 0) {
                processedOptions.mobile.devices = options.mobile.devices;
            }
            
            // Check if 'fullPage' is provided and is a boolean, otherwise set default to true
            if (options.mobile.hasOwnProperty('fullPage') && typeof options.mobile.fullPage === 'boolean') {
                processedOptions.mobile.fullPage = options.mobile.fullPage;
            } else {
                processedOptions.mobile.fullPage = true; // Default value for fullPage
            }
        
            // Check if 'orientation' is provided and is valid, otherwise set default to 'portrait'
            if (options.mobile.hasOwnProperty('orientation') && (options.mobile.orientation === constants.MOBILE_ORIENTATION_PORTRAIT || options.mobile.orientation === constants.MOBILE_ORIENTATION_LANDSCAPE)) {
                processedOptions.mobile.orientation = options.mobile.orientation;
            } else {
                processedOptions.mobile.orientation = constants.MOBILE_ORIENTATION_PORTRAIT; // Default value for orientation
            }
        }

        if (options.element && Object.keys(options.element).length) {
            if (options.element.id) processedOptions.element = '#' + options.element.id;
            else if (options.element.class) processedOptions.element = '.' + options.element.class;
            else if (options.element.cssSelector) processedOptions.element = options.element.cssSelector;
            else if (options.element.xpath) processedOptions.element = 'xpath=' + options.element.xpath;
        } else if (options.ignoreDOM && Object.keys(options.ignoreDOM).length && isNotAllEmpty(options.ignoreDOM)) {
            processedOptions.ignoreBoxes = {};
            ignoreOrSelectDOM = 'ignoreDOM';
            ignoreOrSelectBoxes = 'ignoreBoxes';
        } else if (options.selectDOM && Object.keys(options.selectDOM).length && isNotAllEmpty(options.selectDOM)) {
            processedOptions.selectBoxes = {};
            ignoreOrSelectDOM = 'selectDOM';
            ignoreOrSelectBoxes = 'selectBoxes';
        }
        if (ignoreOrSelectDOM) {
            for (const [key, value] of Object.entries(options[ignoreOrSelectDOM])) {
                switch (key) {
                    case 'id':
                        selectors.push(...value.map(e => '#' + e));
                        break;
                    case 'class':
                        selectors.push(...value.map(e => '.' + e));
                        break;
                    case 'xpath':
                        selectors.push(...value.map(e => 'xpath=' + e));
                        break;
                    case 'cssSelector':
                        selectors.push(...value);
                        break;
                }
            }
        }
        if(options.ignoreType){
            processedOptions.ignoreType = options.ignoreType;
        }
    }

    if (ctx.config.tunnel) {
        if (ctx.tunnelDetails && ctx.tunnelDetails.tunnelPort != -1 && ctx.tunnelDetails.tunnelHost != '') {
            const tunnelAddress = `http://${ctx.tunnelDetails.tunnelHost}:${ctx.tunnelDetails.tunnelPort}`;
            processedOptions.tunnelAddress = tunnelAddress;
            ctx.log.debug(`Tunnel address added to processedOptions: ${tunnelAddress}`);
        }
    }

    // process for every viewport
    let navigated: boolean = false;
    let previousDeviceType: string | null = null;

    let renderViewports;

    if((snapshot.options && snapshot.options.web)  || (snapshot.options && snapshot.options.mobile)){
        renderViewports = getRenderViewportsForOptions(snapshot.options)
    } else {
        renderViewports = getRenderViewports(ctx);
    }

    for (const { viewport, viewportString, fullPage, device } of renderViewports) {

        // Check if this is the first iteration or if the device type has changed from the previous iteration
        if (previousDeviceType !== null && previousDeviceType !== device) {
            // If the device type has changed, reset `navigated` to false
            // This indicates that we haven't navigated to the required page for the new device type yet
            navigated = false;
        }

        // Update `previousDeviceType` to the current device type for comparison in the next iteration
        previousDeviceType = device;

        await page.setViewportSize({ width: viewport.width, height: viewport.height || MIN_VIEWPORT_HEIGHT });
        ctx.log.debug(`Page resized to ${viewport.width}x${viewport.height || MIN_VIEWPORT_HEIGHT}`);
        globalViewport = viewportString;
        ctx.log.debug(`globalViewport : ${globalViewport}`);
        if (globalViewport.toLowerCase().includes("iphone") || globalViewport.toLowerCase().includes("ipad")) {
            globalBrowser = constants.WEBKIT;
        } else {
            globalBrowser = constants.CHROME;
        }

        type WaitUntilOption = 'load' | 'domcontentloaded';

        const envWaitUntil = ctx.env.SMARTUI_PAGE_WAIT_UNTIL_EVENT;

        // Check if the environment value is valid
        const waitUntil: WaitUntilOption =
            (envWaitUntil === 'load' || envWaitUntil === 'domcontentloaded')
                ? (envWaitUntil as WaitUntilOption)
                : 'domcontentloaded';


        ctx.log.debug(`Wait until: ${waitUntil}`);

        // navigate to snapshot url once
        if (!navigated) {
            try {
                discoveryErrors.url = snapshot.url;
                discoveryErrors.name = snapshot.name;
                // domcontentloaded event is more reliable than load event
                await page.goto(snapshot.url, {waitUntil: waitUntil, timeout: ctx.config.waitForDiscovery});
                if (waitUntil === 'domcontentloaded') {
                    // adding extra timeout since domcontentloaded event is fired pretty quickly
                    ctx.log.debug(`Waiting for 1250 ms since waiting for ${waitUntil}`);
                    await new Promise(r => setTimeout(r, 1250));
                }
                if (ctx.config.waitForTimeout) await page.waitForTimeout(ctx.config.waitForTimeout);
                navigated = true;
                ctx.log.debug(`Navigated to ${snapshot.url}`);
            } catch (error: any) {
                ctx.log.debug(`Navigation to discovery page failed; ${error}`)
                if (error && error.name && error.name === 'TimeoutError') {
                    ctx.log.debug(`Payload uploaded tough navigation to discovery page failed; ${error}`)
                    return {
                        processedSnapshot: {
                            name: snapshot.name,
                            url: snapshot.url,
                            dom: Buffer.from(snapshot.dom.html).toString('base64'),
                            resources: cache,
                            options: processedOptions
                        },
                        warnings: [...optionWarnings, ...snapshot.dom.warnings]
                    };
                }
            }

        }
        if (ctx.config.cliEnableJavaScript && fullPage) await page.evaluate(scrollToBottomAndBackToTop, { frequency: 100, timing: ctx.config.scrollTime });

        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
            ctx.log.debug('Network idle 500ms');
        } catch (error) {
            ctx.log.debug(`Network idle failed due to ${error}`);
        }

        // snapshot options
        if (processedOptions.element) {
            let l = await page.locator(processedOptions.element).all()
            if (l.length === 0) {
                throw new Error(`for snapshot ${snapshot.name} viewport ${viewportString}, no element found for selector ${processedOptions.element}`);
            } else if (l.length > 1) {
                throw new Error(`for snapshot ${snapshot.name} viewport ${viewportString}, multiple elements found for selector ${processedOptions.element}`);
            }
        } else if (selectors.length) {
            let height = 0;
            height = await page.evaluate(() => {
                const DEFAULT_HEIGHT = 16384;
                const body = document.body;
                const html = document.documentElement;
                if (!body || !html) {
                    ctx.log.debug('Document body or html element is missing, using default height');
                    return DEFAULT_HEIGHT;
                }
                const measurements = [
                    body?.scrollHeight || 0,
                    body?.offsetHeight || 0,
                    html?.clientHeight || 0,
                    html?.scrollHeight || 0,
                    html?.offsetHeight || 0
                ];
                const allMeasurementsInvalid = measurements.every(measurement => !measurement);
                if (allMeasurementsInvalid) {
                    ctx.log.debug('All height measurements are invalid, using default height');
                    return DEFAULT_HEIGHT;
                }
                return Math.max(...measurements);
            });
            ctx.log.debug(`Calculated content height: ${height}`);

            let locators: Array<Locator> = [];
            if (!Array.isArray(processedOptions[ignoreOrSelectBoxes][viewportString])) processedOptions[ignoreOrSelectBoxes][viewportString] = []

            for (const selector of selectors) {
                let l = await page.locator(selector).all()
                if (l.length === 0) {
                    optionWarnings.add(`for snapshot ${snapshot.name} viewport ${viewportString}, no element found for selector ${selector}`);
                    continue;
                }
                locators.push(...l);
            }
            for (const locator of locators) {
                let bb = await locator.boundingBox();
                if (bb) {
                    // Calculate top and bottom from the bounding box properties
                    const top = bb.y;
                    const bottom = bb.y + bb.height;
            
                    // Only push if top and bottom are within the calculated height
                    if (top <= height && bottom <= height) {
                        processedOptions[ignoreOrSelectBoxes][viewportString].push({
                            left: bb.x,
                            top: top,
                            right: bb.x + bb.width,
                            bottom: bottom
                        });
                    } else {
                        ctx.log.debug(`Bounding box for selector skipped due to exceeding height: ${JSON.stringify({ top, bottom, height })}`);
                    }
                }
            }
        }
        processedOptions.ignoreDOM = options?.ignoreDOM;
        processedOptions.selectDOM = options?.selectDOM;
        ctx.log.debug(`Processed options: ${JSON.stringify(processedOptions)}`);
    }

    
    let hasBrowserErrors = false;
    for (let browser in discoveryErrors.browsers) {
        if (discoveryErrors.browsers[browser]) {
            for (let viewport in discoveryErrors.browsers[browser]) {
                if (discoveryErrors.browsers[browser][viewport].length > 0) {
                    hasBrowserErrors = true;
                    ctx.build.hasDiscoveryError=true
                    break; 
                }
            }
        }
    }

    if (hasBrowserErrors) {
        discoveryErrors.timestamp = new Date().toISOString();
        // ctx.log.warn(discoveryErrors);
    }

    if (ctx.config.useGlobalCache) {
        const keys = globalCache.keys();
        keys.forEach((key) => {
            if (!(key in cache)) {
                const globalCacheData = globalCache.get(key);
                if (globalCacheData) {
                    cache[key] = globalCacheData;
                }
            }
        });
    }
    return {
        processedSnapshot: {
            name: snapshot.name,
            url: snapshot.url,
            dom: Buffer.from(snapshot.dom.html).toString('base64'),
            resources: cache,
            options: processedOptions
        },
        warnings: [...optionWarnings, ...snapshot.dom.warnings],
        discoveryErrors: discoveryErrors
    }
}
