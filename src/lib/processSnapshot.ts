import { Snapshot, Context, DiscoveryErrors } from "../types.js";
import { scrollToBottomAndBackToTop, smoothScrollToBottom, getRenderViewports, getRenderViewportsForOptions, validateCoordinates, resolveCustomCSS, parseCSSFile, validateCSSSelectors, generateCSSInjectionReport, transformCustomViewportsToBrowserViewports } from "./utils.js"
import { chromium, Locator } from "@playwright/test"
import constants from "./constants.js";
import { updateLogContext } from '../lib/logger.js'
import NodeCache from 'node-cache';
import chalk from "chalk";

const globalCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const MAX_RESOURCE_SIZE = 15 * (1024 ** 2); // 15MB
var ALLOWED_RESOURCES = ['document', 'stylesheet', 'image', 'media', 'font', 'other'];
const ALLOWED_STATUSES = [200, 201];
const REQUEST_TIMEOUT = 180000;
const MIN_VIEWPORT_HEIGHT = 1080;
const MAX_WAIT_FOR_REQUEST_CALL = 30000;

const normalizeSameSite = (value) => {
    if (!value) return 'Lax';

    const normalized = value.trim().toLowerCase();
    const mapping = {
        'lax': 'Lax',
        'strict': 'Strict',
        'none': 'None'
    };

    return mapping[normalized] || value;
};

function cacheSerializedResources(domResources: Array<any>): Record<string, any> {
    let cache: Record<string, any> = {};
    if (domResources && domResources.length) {
        for (let resource of domResources) {
            let body = resource.mimetype == 'text/css' ? Buffer.from(resource.content).toString('base64') : resource.content;
            cache[resource.url] = {
                body: body,
                type: resource.mimetype
            }
        }
    }
    return cache;
}

export async function prepareSnapshot(snapshot: Snapshot, ctx: Context): Promise<Record<string, any>> {
    let processedOptions: Record<string, any> = {};
    processedOptions.cliEnableJavascript = ctx.config.cliEnableJavaScript;
    processedOptions.ignoreHTTPSErrors = ctx.config.ignoreHTTPSErrors;
    if (ctx.config.basicAuthorization) {
        processedOptions.basicAuthorization = ctx.config.basicAuthorization;
    }
    if (ctx.config.requestHeaders && Array.isArray(ctx.config.requestHeaders)) {
        processedOptions.requestHeaders = ctx.config.requestHeaders
    }
    ctx.config.allowedHostnames.push(new URL(snapshot.url).hostname);
    processedOptions.allowedHostnames = ctx.config.allowedHostnames;
    processedOptions.skipCapturedCookies = ctx.env.SMARTUI_DO_NOT_USE_CAPTURED_COOKIES;

    if (ctx.env.HTTP_PROXY || ctx.env.HTTPS_PROXY) processedOptions.proxy = { server: ctx.env.HTTP_PROXY || ctx.env.HTTPS_PROXY };
    if (ctx.env.SMARTUI_HTTP_PROXY || ctx.env.SMARTUI_HTTPS_PROXY) processedOptions.proxy = { server: ctx.env.SMARTUI_HTTP_PROXY || ctx.env.SMARTUI_HTTPS_PROXY };

    let options = snapshot.options;
    let optionWarnings: Set<string> = new Set();
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
        if (options.useExtendedViewport) {
            processedOptions.useExtendedViewport = true;
        }
        if (options.pageCustomScroll) {
            processedOptions.pageCustomScroll = true;
        }
        if (options.elementsCustomScroll) {
            processedOptions.elementsCustomScroll = true;
        }
        if (options.pageCustomScroll || options.elementsCustomScroll) {
            ctx.log.warn(`Custom scroll only works at the (browser, viewport) your test ran in — other combos will drift.`);
        }
        if (options.sessionId) {
            const sessionId = options.sessionId;
            processedOptions.sessionId = sessionId
            if (options.testId) {
                processedOptions.testId = options.testId;
            } else if (ctx.sessionCapabilitiesMap && ctx.sessionCapabilitiesMap.has(sessionId)) {
                const sessionCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
                if (sessionCapabilities && sessionCapabilities.id) {
                    processedOptions.testId = sessionCapabilities.id;
                }
            }
            if (options.testName) {
                processedOptions.testName = options.testName;
            } else if (processedOptions.testId && ctx.testIdTestNameMap?.has(processedOptions.testId)) {
                processedOptions.testName = ctx.testIdTestNameMap.get(processedOptions.testId);
            } else if (ctx.sessionCapabilitiesMap && ctx.sessionCapabilitiesMap.has(sessionId)) {
                const sessionCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
                const sessionTestName = sessionCapabilities?.testName || sessionCapabilities?.name;
                if (sessionTestName) {
                    processedOptions.testName = sessionTestName;
                }
            }
        }

        if (options.web && Object.keys(options.web).length) {
            processedOptions.web = {};

            if (options.web.customViewports && Array.isArray(options.web.customViewports) && options.web.customViewports.length > 0) {
                processedOptions.web.browserViewports = transformCustomViewportsToBrowserViewports(options.web.customViewports);
            } else {
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

            // Clear empty web object so global fallback can trigger
            if (Object.keys(processedOptions.web).length === 0) {
                delete processedOptions.web;
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
                    case 'coordinates':
                        selectors.push(...value.map(e => `coordinates=${e}`));
                        break;
                }
            }
        }
        if (options.ignoreType) {
            processedOptions.ignoreType = options.ignoreType;
        }
    }

    // Global browserViewports fallback — runs when options is empty or has no web override
    if (!processedOptions.web && ctx.config.web?.browserViewports) {
        processedOptions.web = { browserViewports: ctx.config.web.browserViewports };
    }

    if (ctx.config.tunnel) {
        if (ctx.tunnelDetails && ctx.tunnelDetails.tunnelPort != -1 && ctx.tunnelDetails.tunnelHost != '') {
            const tunnelAddress = `http://${ctx.tunnelDetails.tunnelHost}:${ctx.tunnelDetails.tunnelPort}`;
            processedOptions.tunnelAddress = tunnelAddress;
            ctx.log.debug(`Tunnel address added to processedOptions: ${tunnelAddress}`);
        }
    }

    if (ctx.config.loadDomContent) {
        processedOptions.loadDomContent = true;
    }
    if (ctx.config.useExtendedViewport) {
        processedOptions.useExtendedViewport = true;
    }

    if (ctx.config.lazyLoadConfiguration && ctx.config.lazyLoadConfiguration.enabled) {
        let stepValue = ctx.config.lazyLoadConfiguration.scrollStep || 250;
        let delayValue = ctx.config.lazyLoadConfiguration.scrollDelay || 100;
        let maxScrollsValue = ctx.config.lazyLoadConfiguration.maxScrolls || 50;
        let jumpBackToTopValue = ctx.config.lazyLoadConfiguration.jumpBackToTop !== false;
        //Add this in processed options inside lazyLoadConfiguration key
        processedOptions.lazyLoadConfiguration = {
            enabled: true,
            scrollStep: stepValue,
            scrollDelay: delayValue,
            maxScrolls: maxScrollsValue,
            jumpBackToTop: jumpBackToTopValue
        };
    }

    try {
        if (options?.customCSS) {
            const resolvedCSS = resolveCustomCSS(options.customCSS, '', ctx.log);
            processedOptions.customCSS = resolvedCSS;
            ctx.log.debug('Using per-snapshot customCSS (overriding config)');
        } else if (ctx.config.customCSS) {
            processedOptions.customCSS = ctx.config.customCSS;
            ctx.log.debug('Using config customCSS');
        }
    } catch (error: any) {
        ctx.log.warn(`customCSS warning: ${error.message}`);
        chalk.yellow(`[SmartUI] warning: ${error.message}`);
    }

    processedOptions.allowedAssets = ctx.config.allowedAssets;
    processedOptions.selectors = selectors;

    processedOptions.ignoreDOM = options?.ignoreDOM;
    processedOptions.selectDOM = options?.selectDOM;
    processedOptions.ignoreColors = options?.ignoreColors;

    //Add custom cookies in processed options
    if (options?.customCookies && Array.isArray(options.customCookies) && options.customCookies.length > 0) {
        ctx.log.debug(`Setting ${options.customCookies.length} custom cookies`);
        processedOptions.customCookies = options.customCookies
    }

    ctx.log.debug(`Processed options: ${JSON.stringify(processedOptions)}`);

    let renderViewports;
    if ((snapshot.options && snapshot.options.web) || (snapshot.options && snapshot.options.mobile)) {
        renderViewports = getRenderViewportsForOptions(snapshot.options)
    } else {
        renderViewports = getRenderViewports(ctx);
    }

    processedOptions.doRemoteDiscovery = true;

    return {
        processedSnapshot: {
            name: snapshot.name,
            url: snapshot.url,
            dom: Buffer.from(snapshot.dom.html).toString('base64'),
            resources: cacheSerializedResources(snapshot.dom.resources),
            options: processedOptions,
            cookies:  Buffer.from(snapshot.dom.cookies ?? '').toString('base64'),
            renderViewports: renderViewports,
        },
        warnings: [...optionWarnings, ...snapshot.dom.warnings],
    }
}

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

    let processedOptions: Record<string, any> = {};
    if (ctx.config.requestHeaders && Array.isArray(ctx.config.requestHeaders)) {
        processedOptions.requestHeaders = ctx.config.requestHeaders
    }

    let globalViewport = ""
    let globalBrowser = constants.CHROME
    let launchOptions: Record<string, any> = {
        headless: isHeadless,
        args: constants.LAUNCH_ARGS
    }
    let contextOptions: Record<string, any> = {
        javaScriptEnabled: ctx.config.cliEnableJavaScript,
        ignoreHTTPSErrors: ctx.config.ignoreHTTPSErrors,
    };

    if (!ctx.env.DO_NOT_USE_USER_AGENT) {
        contextOptions.userAgent = constants.CHROME_USER_AGENT;
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

    let options = snapshot.options;

    // Custom cookies include those which cannot be captured by javascript function `document.cookie` like httpOnly, secure, sameSite etc.
    // These custom cookies will be captured by the user in their automation browser and sent to CLI through the snapshot options using `customCookies` field.
    if (options?.customCookies && Array.isArray(options.customCookies) && options.customCookies.length > 0) {
        ctx.log.debug(`Setting ${options.customCookies.length} custom cookies`);

        const validCustomCookies = options.customCookies.filter(cookie => {
            if (!cookie.name || !cookie.value || !cookie.domain) {
                ctx.log.debug(`Skipping invalid custom cookie: missing required fields (name, value, or domain)`);
                return false;
            }

            const sameSiteValue = normalizeSameSite(cookie.sameSite);
            if (!['Strict', 'Lax', 'None'].includes(sameSiteValue)) {
                ctx.log.debug(`Skipping invalid custom cookie: invalid sameSite value '${cookie.sameSite}'`);
                return false;
            }
            return true;
        }).map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite: normalizeSameSite(cookie.sameSite)
        }));

        if (validCustomCookies.length > 0) {
            try {
                await context.addCookies(validCustomCookies);
                ctx.log.debug(`Successfully added ${validCustomCookies.length} custom cookies`);
            } catch (error) {
                ctx.log.debug(`Failed to add custom cookies: ${error}`);
            }
        } else {
            ctx.log.debug('No valid custom cookies to add');
        }
    }
    const page = await context.newPage();

    // populate cache with already captured resources
    let cache: Record<string, any> = cacheSerializedResources(snapshot.dom.resources);

    const pendingRequests = new Set<string>();

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
            if (ctx.config.requestHeaders && Array.isArray(ctx.config.requestHeaders)) {
                ctx.config.requestHeaders.forEach((headerObj) => {
                    Object.entries(headerObj).forEach(([key, value]) => {
                        requestOptions.headers[key] = value;
                    });
                });
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
                if (ctx.build.checkPendingRequests) {
                    pendingRequests.add(requestUrl);
                }
                response = await page.request.fetch(request, requestOptions);
                body = await response.body();
                if (ctx.build.checkPendingRequests) {
                    pendingRequests.delete(requestUrl);
                }
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
            } else if (!ALLOWED_STATUSES.includes(response.status())) {
                ctx.log.debug(`${globalViewport} Handling request ${requestUrl}\n - skipping disallowed status [${response.status()}]`);

                if (response && response.headers()) {
                    const responseHeaders = response.headers();
                    ctx.log.debug(`Response headers for ${requestUrl}: ${JSON.stringify(responseHeaders, null, 2)}`);
                }

                let responseOfRetry, bodyOfRetry
                ctx.log.debug(`Resource had a disallowed status ${requestUrl} fetching from server again`);
                if (ctx.build.checkPendingRequests) {
                    pendingRequests.add(requestUrl);
                }
                responseOfRetry = await page.request.fetch(request, requestOptions);
                bodyOfRetry = await responseOfRetry.body();
                if (ctx.build.checkPendingRequests) {
                    pendingRequests.delete(requestUrl);
                }
                if (responseOfRetry && responseOfRetry.status() && ALLOWED_STATUSES.includes(responseOfRetry.status())) {
                    ctx.log.debug(`Handling request after retry ${requestUrl}\n - content-type ${responseOfRetry.headers()['content-type']}`);
                    cache[requestUrl] = {
                        body: bodyOfRetry.toString('base64'),
                        type: responseOfRetry.headers()['content-type']
                    }
                    if (ctx.config.useGlobalCache) {
                        globalCache.set(requestUrl, {
                            body: bodyOfRetry.toString('base64'),
                            type: responseOfRetry.headers()['content-type']
                        });
                    }
                    route.fulfill({
                        status: responseOfRetry.status(),
                        headers: responseOfRetry.headers(),
                        body: bodyOfRetry,
                    });
                } else {
                    ctx.log.debug(`Resource had a disallowed status for retry as well  ${requestUrl} disallowed status [${responseOfRetry.status()}]`);
                    if (responseOfRetry && responseOfRetry.headers()) {
                        const responseHeadersRetry = responseOfRetry.headers();
                        ctx.log.debug(`Response headers for retry ${requestUrl}: ${JSON.stringify(responseHeadersRetry, null, 2)}`);
                    }

                    let data = {
                        statusCode: `${responseOfRetry.status()}`,
                        url: requestUrl,
                        resourceType: request.resourceType(),
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
                            discoveryErrors.browsers[globalBrowser][globalViewport]?.push(data);
                        }
                    }
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
    let optionWarnings: Set<string> = new Set();
    let selectors: Array<string> = [];
    let ignoreOrSelectDOM: string;
    let ignoreOrSelectBoxes: string;
    let ignoreColorsSelectors: Array<string> = [];
    let ignoreColorsFullPage: boolean = false;
    if (options && Object.keys(options).length) {
        ctx.log.debug(`Snapshot options: ${JSON.stringify(options)}`);

        const isNotAllEmpty = (obj: Record<string, Array<string>>): boolean => {
            for (let key in obj) if (obj[key]?.length) return true;
            return false;
        }

        if (options.loadDomContent) {
            processedOptions.loadDomContent = true;
        }

        if (options.pageCustomScroll) {
            processedOptions.pageCustomScroll = true;
        }
        if (options.elementsCustomScroll) {
            processedOptions.elementsCustomScroll = true;
        }
        if (options.pageCustomScroll || options.elementsCustomScroll) {
            ctx.log.warn(`Custom scroll only works at the (browser, viewport) your test ran in — other combos will drift.`);
        }

        if (options.sessionId) {
            const sessionId = options.sessionId;
            processedOptions.sessionId = sessionId
            if (options.testId) {
                processedOptions.testId = options.testId;
            } else if (ctx.sessionCapabilitiesMap && ctx.sessionCapabilitiesMap.has(sessionId)) {
                const sessionCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
                if (sessionCapabilities && sessionCapabilities.id) {
                    processedOptions.testId = sessionCapabilities.id;
                }
            }
            if (options.testName) {
                processedOptions.testName = options.testName;
            } else if (processedOptions.testId && ctx.testIdTestNameMap?.has(processedOptions.testId)) {
                processedOptions.testName = ctx.testIdTestNameMap.get(processedOptions.testId);
            } else if (ctx.sessionCapabilitiesMap && ctx.sessionCapabilitiesMap.has(sessionId)) {
                const sessionCapabilities = ctx.sessionCapabilitiesMap.get(sessionId);
                const sessionTestName = sessionCapabilities?.testName || sessionCapabilities?.name;
                if (sessionTestName) {
                    processedOptions.testName = sessionTestName;
                }
            }
        }

        if (options.web && Object.keys(options.web).length) {
            processedOptions.web = {};

            if (options.web.customViewports && Array.isArray(options.web.customViewports) && options.web.customViewports.length > 0) {
                processedOptions.web.browserViewports = transformCustomViewportsToBrowserViewports(options.web.customViewports);
            } else {
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

            // Clear empty web object so global fallback can trigger
            if (Object.keys(processedOptions.web).length === 0) {
                delete processedOptions.web;
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
                        selectors.push(...value.map(e => e.startsWith('#') ? e : '#' + e));
                        break;
                    case 'class':
                        selectors.push(...value.map(e => e.startsWith('.') ? e : '.' + e));
                        break;
                    case 'xpath':
                        selectors.push(...value.map(e => e.startsWith('xpath=') ? e : 'xpath=' + e));
                        break;
                    case 'cssSelector':
                        selectors.push(...value);
                        break;
                    case 'coordinates':
                        selectors.push(...value.map(e => `coordinates=${e}`));
                        break;
                }
            }
        }
        if (options.ignoreColors && Object.keys(options.ignoreColors).length) {
            const { fullPage: icFullPage, ...ignoreColorsGroups } = options.ignoreColors;
            if (icFullPage === true) {
                ignoreColorsFullPage = true;
            }
            if (isNotAllEmpty(ignoreColorsGroups as Record<string, Array<string>>)) {
                for (const [key, value] of Object.entries(ignoreColorsGroups)) {
                    if (!Array.isArray(value)) continue;
                    switch (key) {
                        case 'id':
                            ignoreColorsSelectors.push(...value.map(e => e.startsWith('#') ? e : '#' + e));
                            break;
                        case 'class':
                            ignoreColorsSelectors.push(...value.map(e => e.startsWith('.') ? e : '.' + e));
                            break;
                        case 'xpath':
                            ignoreColorsSelectors.push(...value.map(e => e.startsWith('xpath=') ? e : 'xpath=' + e));
                            break;
                        case 'cssSelector':
                            ignoreColorsSelectors.push(...value);
                            break;
                        case 'coordinates':
                            ignoreColorsSelectors.push(...value.map(e => `coordinates=${e}`));
                            break;
                    }
                }
            }
        }
        if (options.ignoreType) {
            processedOptions.ignoreType = options.ignoreType;
        }
    }

    // Global browserViewports fallback — runs when options is empty or has no web override
    if (!processedOptions.web && ctx.config.web?.browserViewports) {
        processedOptions.web = { browserViewports: ctx.config.web.browserViewports };
    }

    if (ctx.config.tunnel) {
        if (ctx.tunnelDetails && ctx.tunnelDetails.tunnelPort != -1 && ctx.tunnelDetails.tunnelHost != '') {
            const tunnelAddress = `http://${ctx.tunnelDetails.tunnelHost}:${ctx.tunnelDetails.tunnelPort}`;
            processedOptions.tunnelAddress = tunnelAddress;
            ctx.log.debug(`Tunnel address added to processedOptions: ${tunnelAddress}`);
        }
    }

    if (ctx.config.loadDomContent) {
        processedOptions.loadDomContent = true;
    }
    if (ctx.config.useExtendedViewport) {
        processedOptions.useExtendedViewport = true;
    }

    try {
        if (options?.customCSS) {
            const resolvedCSS = resolveCustomCSS(options.customCSS, '', ctx.log);
            processedOptions.customCSS = resolvedCSS;
        } else if (ctx.config.customCSS) {
            processedOptions.customCSS = ctx.config.customCSS;
        }
    } catch (error: any) {
        optionWarnings.add(`${error.message}`);
    }

    ctx.log.debug(`Processed options: ${JSON.stringify(processedOptions)}`);

    // process for every viewport
    let navigated: boolean = false;
    let previousDeviceType: string | null = null;

    let renderViewports;

    if ((snapshot.options && snapshot.options.web) || (snapshot.options && snapshot.options.mobile)) {
        renderViewports = getRenderViewportsForOptions(snapshot.options)
    } else {
        renderViewports = getRenderViewports(ctx);
    }

    if (ctx.config.lazyLoadConfiguration && ctx.config.lazyLoadConfiguration.enabled) {
        let stepValue = ctx.config.lazyLoadConfiguration.scrollStep || 250;
        let delayValue = ctx.config.lazyLoadConfiguration.scrollDelay || 100;
        let maxScrollsValue = ctx.config.lazyLoadConfiguration.maxScrolls || 50;
        let jumpBackToTopValue = ctx.config.lazyLoadConfiguration.jumpBackToTop || false;
        //Add this in processed options inside lazyLoadConfiguration key
        processedOptions.lazyLoadConfiguration = {
            enabled: true,
            scrollStep: stepValue,
            scrollDelay: delayValue,
            maxScrolls: maxScrollsValue,
            jumpBackToTop: jumpBackToTopValue
        };
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

        // navigate to snapshot url once
        if (!navigated) {
            try {
                discoveryErrors.url = snapshot.url;
                discoveryErrors.name = snapshot.name;
                // domcontentloaded event is more reliable than load event
                await page.goto(snapshot.url, { waitUntil: "domcontentloaded", timeout: ctx.config.waitForDiscovery });
                // adding extra timeout since domcontentloaded event is fired pretty quickly
                await new Promise(r => setTimeout(r, 1250));
                if (ctx.config.waitForTimeout) await page.waitForTimeout(ctx.config.waitForTimeout);
                await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { ctx.log.debug('networkidle event failed to fire within 10s') });
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
        if (ctx.config.cliEnableJavaScript && fullPage) {
            if (ctx.config.lazyLoadConfiguration && ctx.config.lazyLoadConfiguration.enabled) {
                let stepValue = ctx.config.lazyLoadConfiguration.scrollStep || 250;
                let delayValue = ctx.config.lazyLoadConfiguration.scrollDelay || 300;
                let maxScrollsValue = ctx.config.lazyLoadConfiguration.maxScrolls || 50;
                let jumpBackToTopValue = ctx.config.lazyLoadConfiguration.jumpBackToTop !== false;
                ctx.log.debug('Starting lazy load scrolling with configuration: ' + JSON.stringify({ step: stepValue, delay: delayValue, maxScrolls: maxScrollsValue, jumpBackToTop: jumpBackToTopValue }));
                await page.evaluate(smoothScrollToBottom, { step: stepValue, delay: delayValue, maxScrolls: maxScrollsValue, jumpBackToTop: jumpBackToTopValue });
                ctx.log.debug('Completed lazy load scrolling');
            } else {
                await page.evaluate(scrollToBottomAndBackToTop, { frequency: 100, timing: ctx.config.scrollTime });
            }
        }

        try {
            await page.waitForLoadState('networkidle', { timeout: 15000 });
            ctx.log.debug('Network idle 500ms');
        } catch (error) {
            ctx.log.debug(`Network idle failed due to ${error}`);
        }



        if (ctx.config.allowedAssets && ctx.config.allowedAssets.length) {
            for (let assetUrl of ctx.config.allowedAssets) {
                if (!cache[assetUrl]) {
                    ctx.log.debug(`Fetching asset ${assetUrl} from allowedAssets array`);
                    try {
                        const response = await page.request.fetch(assetUrl, {
                            timeout: 25000,
                            headers: {
                                ...constants.REQUEST_HEADERS
                            }
                        });

                        const body = await response.body();

                        if (body && body.length) {
                            ctx.log.debug(`Caching asset ${assetUrl}`);
                            cache[assetUrl] = {
                                body: body.toString('base64'),
                                type: response.headers()['content-type']
                            };
                        } else {
                            ctx.log.debug(`Asset ${assetUrl} returned empty or invalid body`);
                        }
                    } catch (error) {
                        if (error && error.message) {
                            ctx.log.debug(`Error fetching asset with error message ${assetUrl}: ${error.message}`);
                        }
                        ctx.log.debug(`Error fetching asset ${assetUrl}: ${JSON.stringify(error)}`);
                    }
                } else {
                    ctx.log.debug(`Asset ${assetUrl} already cached`);
                }
            }
        }

        // snapshot options
        if (selectors.length || ignoreColorsSelectors.length || ignoreColorsFullPage) {
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
            if (ignoreOrSelectBoxes && !Array.isArray(processedOptions[ignoreOrSelectBoxes][viewportString])) processedOptions[ignoreOrSelectBoxes][viewportString] = []

            for (const selector of selectors) {
                if (selector.startsWith('coordinates=')) {
                    const coordString = selector.replace('coordinates=', '');
                    let pageHeight = height;
                    if (viewport.height) {
                        pageHeight = viewport.height;
                    }
                    const validation = validateCoordinates(
                        coordString,
                        pageHeight,
                        viewport.width,
                        snapshot.name
                    );

                    if (!validation.valid) {
                        optionWarnings.add(validation.error!);
                        continue;
                    }

                    if (renderViewports.length > 1) {
                        optionWarnings.add(`for snapshot ${snapshot.name} viewport ${viewportString}, coordinates may not be accurate for multiple viewports`);
                    }


                    const coordinateElement = {
                        type: 'coordinates',
                        ...validation.coords
                    };
                    locators.push(coordinateElement as any);
                    continue;

                } else {
                    const isXPath = selector.startsWith('xpath=');
                    const selectorValue = isXPath ? selector.substring(6) : selector;

                    const boxes = await page.evaluate(({ selectorValue, isXPath }) => {
                        try {
                            // First, determine the page height
                            const DEFAULT_HEIGHT = 16384;
                            const DEFAULT_WIDTH = 7680;
                            const body = document.body;
                            const html = document.documentElement;

                            let pageHeight;
                            let pageWidth;

                            if (!body || !html) {
                                pageHeight = DEFAULT_HEIGHT;
                                pageWidth = DEFAULT_WIDTH;
                            } else {
                                const measurements = [
                                    body?.scrollHeight || 0,
                                    body?.offsetHeight || 0,
                                    html?.clientHeight || 0,
                                    html?.scrollHeight || 0,
                                    html?.offsetHeight || 0
                                ];

                                const allMeasurementsInvalid = measurements.every(measurement => !measurement);

                                if (allMeasurementsInvalid) {
                                    pageHeight = DEFAULT_HEIGHT;
                                } else {
                                    pageHeight = Math.max(...measurements);
                                }

                                const measurementsWidth = [
                                    body?.scrollWidth || 0,
                                    body?.offsetWidth || 0,
                                    html?.clientWidth || 0,
                                    html?.scrollWidth || 0,
                                    html?.offsetWidth || 0
                                ];

                                const allMeasurementsInvalidWidth = measurementsWidth.every(measurement => !measurement);

                                if (allMeasurementsInvalidWidth) {
                                    pageWidth = DEFAULT_WIDTH;
                                } else {
                                    pageWidth = Math.max(...measurementsWidth);
                                }
                            }

                            let elements = [];

                            if (isXPath) {
                                // Use XPath evaluation
                                const xpathResult = document.evaluate(
                                    selectorValue,
                                    document,
                                    null,
                                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                                    null
                                );

                                for (let i = 0; i < xpathResult.snapshotLength; i++) {
                                    elements.push(xpathResult.snapshotItem(i));
                                }
                            } else {
                                elements = Array.from(document.querySelectorAll(selectorValue));
                            }

                            return elements;

                        } catch (error) {
                        }

                    }, { selectorValue, isXPath });

                    if (boxes && boxes.length >= 1) {
                        processedOptions[ignoreOrSelectBoxes][viewportString].push(...boxes);
                    } else {
                        optionWarnings.add(`for snapshot ${snapshot.name} viewport ${viewportString}, no element found for selector ${selector}`);
                    }
                }
            }

            if (ignoreColorsFullPage || ignoreColorsSelectors.length) {
                if (!processedOptions.ignoreBoxes) processedOptions.ignoreBoxes = {};
                if (!Array.isArray(processedOptions.ignoreBoxes[viewportString])) processedOptions.ignoreBoxes[viewportString] = [];
                const ignoreColorsPageHeight = viewport.height ? viewport.height : height;
                if (ignoreColorsFullPage) {
                    processedOptions.ignoreBoxes[viewportString].push({
                        type: constants.IGNORE_COLORS_BOX_TYPE,
                        top: 0,
                        bottom: ignoreColorsPageHeight,
                        left: 0,
                        right: viewport.width
                    });
                }
                for (const selector of ignoreColorsSelectors) {
                    if (selector.startsWith('coordinates=')) {
                        const validation = validateCoordinates(selector.replace('coordinates=', ''), ignoreColorsPageHeight, viewport.width, snapshot.name);
                        if (!validation.valid) {
                            optionWarnings.add(validation.error!);
                            continue;
                        }
                        processedOptions.ignoreBoxes[viewportString].push({ type: constants.IGNORE_COLORS_BOX_TYPE, ...validation.coords });
                    } else {
                        const isXPath = selector.startsWith('xpath=');
                        const selectorValue = isXPath ? selector.substring(6) : selector;
                        const colorBoxes = await page.evaluate(({ selectorValue, isXPath, boxType }) => {
                            try {
                                const body = document.body;
                                const html = document.documentElement;
                                const pageHeight = Math.max(body?.scrollHeight || 0, body?.offsetHeight || 0, html?.clientHeight || 0, html?.scrollHeight || 0, html?.offsetHeight || 0) || 16384;
                                const pageWidth = Math.max(body?.scrollWidth || 0, body?.offsetWidth || 0, html?.clientWidth || 0, html?.scrollWidth || 0, html?.offsetWidth || 0) || 7680;
                                let elements: Element[] = [];
                                if (isXPath) {
                                    const xpathResult = document.evaluate(selectorValue, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                                    for (let i = 0; i < xpathResult.snapshotLength; i++) {
                                        const node = xpathResult.snapshotItem(i);
                                        if (node instanceof Element) elements.push(node);
                                    }
                                } else {
                                    elements = Array.from(document.querySelectorAll(selectorValue));
                                }
                                return elements.map(el => {
                                    const rect = el.getBoundingClientRect();
                                    return {
                                        type: boxType,
                                        left: Math.max(0, rect.left + window.scrollX),
                                        top: Math.max(0, rect.top + window.scrollY),
                                        right: Math.min(pageWidth, rect.right + window.scrollX),
                                        bottom: Math.min(pageHeight, rect.bottom + window.scrollY)
                                    };
                                }).filter(box => box.right > box.left && box.bottom > box.top);
                            } catch (error) {
                                return [];
                            }
                        }, { selectorValue, isXPath, boxType: constants.IGNORE_COLORS_BOX_TYPE });
                        if (colorBoxes && colorBoxes.length) {
                            processedOptions.ignoreBoxes[viewportString].push(...colorBoxes);
                        } else {
                            optionWarnings.add(`for snapshot ${snapshot.name} viewport ${viewportString}, no element found for ignoreColors selector ${selector}`);
                        }
                    }
                }
            }
        }
        processedOptions.ignoreDOM = options?.ignoreDOM;
        processedOptions.selectDOM = options?.selectDOM;
        processedOptions.ignoreColors = options?.ignoreColors;
        ctx.log.debug(`Processed options: ${JSON.stringify(processedOptions)}`);
    }

    // Wait for pending requests to complete
    const checkPending = async () => {
        let startTime = Date.now();
        ctx.log.debug(`${pendingRequests.size} Pending requests before wait for ${snapshot.name}: ${Array.from(pendingRequests)}`);
        while (pendingRequests.size > 0) {
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime >= MAX_WAIT_FOR_REQUEST_CALL) {
                ctx.log.debug(`Timeout reached (${MAX_WAIT_FOR_REQUEST_CALL / 1000}s). Stopping wait for pending requests.`);
                ctx.log.debug(`${pendingRequests.size} Pending requests after wait for ${snapshot.name}: ${Array.from(pendingRequests)}`);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (pendingRequests.size === 0) {
            ctx.log.debug(`No pending requests for ${snapshot.name}.`);
        }
    };

    if (ctx.build.checkPendingRequests) {
        await checkPending();
    }

    // Validate and report CSS injection after selector processing
    if (processedOptions.customCSS) {
        try {
            const cssRules = parseCSSFile(processedOptions.customCSS);
            const validationResult = await validateCSSSelectors(page, cssRules, ctx.log);
            const report = generateCSSInjectionReport(validationResult, ctx.log);

            if (validationResult.failedSelectors.length > 0) {
                validationResult.failedSelectors.forEach(selector => {
                    optionWarnings.add(`customCSS selector not found: ${selector}`);
                });
            }
        } catch (error: any) {
            ctx.log.warn(`CSS validation failed: ${error.message}`);
            optionWarnings.add(`CSS validation error: ${error.message}`);
        }
    }


    let hasBrowserErrors = false;
    for (let browser in discoveryErrors.browsers) {
        if (discoveryErrors.browsers[browser]) {
            for (let viewport in discoveryErrors.browsers[browser]) {
                if (discoveryErrors.browsers[browser][viewport].length > 0) {
                    hasBrowserErrors = true;
                    ctx.build.hasDiscoveryError = true
                    break;
                }
            }
        }
    }

    if (hasBrowserErrors) {
        discoveryErrors.timestamp = new Date().toISOString();
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


