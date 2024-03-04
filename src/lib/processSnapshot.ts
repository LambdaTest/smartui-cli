import { Snapshot, Context, ProcessedSnapshot } from "../types.js";
import { scrollToBottomAndBackToTop } from "./utils.js"
import { chromium, Locator, selectors } from "@playwright/test"

const MAX_RESOURCE_SIZE = 5 * (1024 ** 2); // 5MB
var ALLOWED_RESOURCES = ['document', 'stylesheet', 'image', 'media', 'font', 'other'];
const ALLOWED_STATUSES = [200, 201];
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
        const snapshotHostname = new URL(snapshot.url).hostname;
        const requestHostname = new URL(requestUrl).hostname;

        try {
            const response = await page.request.fetch(request);
            const body = await response.body();

            if (ctx.webConfig.enableJavaScript) ALLOWED_RESOURCES.push('script');
            if (!body) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping no response`);
            } else if (!body.length) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping empty response`);
            } else if (requestUrl === snapshot.url) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping root resource`);
            } else if (requestHostname !== snapshotHostname) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping remote resource`);
            } else if (cache[requestUrl]) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping already cached resource`);
            } else if (body.length > MAX_RESOURCE_SIZE) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping resource larger than 5MB`);
            } else if (!ALLOWED_STATUSES.includes(response.status())) {
                ctx.log.debug(`Handling request ${requestUrl}\n - skipping disallowed status [${response.status()}]`);
            } else if (!ctx.webConfig.enableJavaScript && !ALLOWED_RESOURCES.includes(request.resourceType())) {
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
        } catch (error) {
            ctx.log.debug(`Handling request ${requestUrl} - aborted`);
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
        
        if ((options.ignoreDOM && Object.keys(options.ignoreDOM).length) || (options.selectDOM && Object.keys(options.selectDOM).length)) {
            if (options.ignoreDOM && Object.keys(options.ignoreDOM).length) {
                processedOptions.ignoreBoxes = {};
                ignoreOrSelectDOM = 'ignoreDOM';
                ignoreOrSelectBoxes = 'ignoreBoxes';
            } else {
                processedOptions.selectBoxes = {};
                ignoreOrSelectDOM = 'selectDOM';
                ignoreOrSelectBoxes = 'selectBoxes';
            }

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
    for (const viewport of ctx.webConfig.viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height ||  MIN_VIEWPORT_HEIGHT });
        ctx.log.debug(`Page resized to ${viewport.width}x${viewport.height ||  MIN_VIEWPORT_HEIGHT}`);
        if (!navigated) {
            await page.goto(snapshot.url);
            navigated = true;
            ctx.log.debug(`Navigated to ${snapshot.url}`);
        }
        if (!viewport.height) await page.evaluate(scrollToBottomAndBackToTop);
        await page.waitForLoadState('networkidle');
        ctx.log.debug('Network idle 500ms');

        // find bounding boxes for elements
        if (selectors.length) {
            let viewportString: string = `${viewport.width}${viewport.height ? 'x'+viewport.height : ''}`;
            if (!Array.isArray(processedOptions[ignoreOrSelectBoxes][viewportString])) processedOptions[ignoreOrSelectBoxes][viewportString] = []
    
            let locators: Array<Locator> = [];
            let boxes: Array<Record<string, number>> = [];
            for (const selector of selectors) {
                let l = await page.locator(selector).all()
                if (l.length === 0) {
                    optionWarnings.add(`For snapshot ${snapshot.name}, no element found for selector ${selector}`);
                    continue;
                }
                locators.push(...l);
            }
            for (const locator of locators) {
                let bb = await locator.boundingBox();
                if (bb) boxes.push({
                    left: bb.x,
                    top: bb.y,
                    right: bb.x + bb.width,
                    bottom: bb.y + bb.height
                });
            }
    
            processedOptions[ignoreOrSelectBoxes][viewportString].push(...boxes);
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
