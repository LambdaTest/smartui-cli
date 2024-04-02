import { Snapshot, Context, ProcessedSnapshot } from "../types.js";
import { scrollToBottomAndBackToTop, getRenderViewports } from "./utils.js"
import { chromium, Locator } from "@playwright/test"

const MAX_RESOURCE_SIZE = 5 * (1024 ** 2); // 5MB
var ALLOWED_RESOURCES = ['document', 'stylesheet', 'image', 'media', 'font', 'other'];
const ALLOWED_STATUSES = [200, 201];
const REQUEST_TIMEOUT = 10000;
const MIN_VIEWPORT_HEIGHT = 1080;

export default async (snapshot: Snapshot, ctx: Context): Promise<Record<string, any>> => {
    ctx.log.debug(`Processing snapshot ${snapshot.name}`);

    if (!ctx.browser) ctx.browser = await chromium.launch({ headless: true });
    const context = await ctx.browser.newContext()
    const page = await context.newPage();
    let cache: Record<string, any> = {};

    // Use route to intercept network requests and discover resources
    await page.route('**/*', async (route, request) => {
        const requestUrl = request.url()
        const requestHostname = new URL(requestUrl).hostname;

        try {
            ctx.config.allowedHostnames.push(new URL(snapshot.url).hostname);
            if (ctx.config.enableJavaScript) ALLOWED_RESOURCES.push('script');

            const response = await page.request.fetch(request, { timeout: REQUEST_TIMEOUT });
            const body = await response.body();
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
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping resource larger than 5MB`);
            } else if (!ALLOWED_STATUSES.includes(response.status())) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping disallowed status [${response.status()}]`);
            } else if (!ALLOWED_RESOURCES.includes(request.resourceType())) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping disallowed resource type [${request.resourceType()}]`);
            } else {
                ctx.log.debug(`Handling request ${requestUrl}\n - content-type ${response.headers()['content-type']}`);
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
    }

    // process for every viewport
    let navigated: boolean = false;
    let renderViewports = getRenderViewports(ctx);
    for (const { viewport, viewportString, fullPage } of renderViewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height ||  MIN_VIEWPORT_HEIGHT });
        ctx.log.debug(`Page resized to ${viewport.width}x${viewport.height ||  MIN_VIEWPORT_HEIGHT}`);
        if (!navigated) {
            await page.goto(snapshot.url);
            navigated = true;
            ctx.log.debug(`Navigated to ${snapshot.url}`);
        }
        if (fullPage) await page.evaluate(scrollToBottomAndBackToTop);
        await page.waitForLoadState('networkidle');
        ctx.log.debug('Network idle 500ms');

        // snapshot options
        if (processedOptions.element) {
            let l = await page.locator(processedOptions.element).all()
            if (l.length === 0) {
                throw new Error(`for snapshot ${snapshot.name} viewport ${viewportString}, no element found for selector ${processedOptions.element}`);
            } else if (l.length > 1) {
                throw new Error(`for snapshot ${snapshot.name} viewport ${viewportString}, multiple elements found for selector ${processedOptions.element}`);
            }
        } else if (selectors.length) {
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
                if (bb) processedOptions[ignoreOrSelectBoxes][viewportString].push({
                    left: bb.x,
                    top: bb.y,
                    right: bb.x + bb.width,
                    bottom: bb.y + bb.height
                });
            }
        }
    }

    await page.close();
    await context.close();

    return {
        processedSnapshot: {
            name: snapshot.name,
            url: snapshot.url,
            dom: Buffer.from(snapshot.dom.html).toString('base64'),
            resources: cache,
            options: processedOptions
        },
        warnings: [...optionWarnings, ...snapshot.dom.warnings]
    }
}
