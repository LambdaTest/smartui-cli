import { Snapshot, Context, ProcessedSnapshot } from "../types.js";
import { chromium, Locator } from "@playwright/test"

const MIN_VIEWPORT_HEIGHT = 1080;

export default async (snapshot: Snapshot, ctx: Context): Promise<Record<string, any>> => {
    // Process snapshot options
    let options = snapshot.options;
    let optionWarnings: Set<string> = new Set();
    let processedOptions: Record<string, any> = {};
    if (options && Object.keys(options).length) {
        ctx.log.debug(`Processing options: ${JSON.stringify(options)}`);
        
        const isNotAllEmpty = (obj: Record<string, Array<string>>): boolean => {
            for (let key in obj) if (obj[key]?.length) return true;
            return false;
        }

        let ignoreOrSelectDOM: string;
        let ignoreOrSelectBoxes: string;
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

        if (processedOptions.element) {
            if (!ctx.browser) ctx.browser = await chromium.launch({ headless: true });
            for (const viewport of ctx.config.web.viewports) {
                const page = await ctx.browser.newPage({ viewport: { width: viewport.width, height: viewport.height || MIN_VIEWPORT_HEIGHT}});
                await page.setContent(snapshot.dom.html);
                let l = await page.locator(processedOptions.element).all();
                await page.close();
                if (l.length === 0) {
                    throw new Error(`for snapshot ${snapshot.name} and viewport ${viewport.width}${viewport.height ? 'x'+viewport.height : ''}, no element found with selector/xpath ${processedOptions.element}`);
                }
            }
        } else if (ignoreOrSelectDOM) {
            if (!ctx.browser) ctx.browser = await chromium.launch({ headless: true });

            let selectors: Array<string> = [];
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
    
            for (const vp of ctx.config.web.viewports) {
                const page = await ctx.browser.newPage({ viewport: { width: vp.width, height: vp.height || MIN_VIEWPORT_HEIGHT}});
                await page.setContent(snapshot.dom.html);

                let viewport: string = `${vp.width}${vp.height ? 'x'+vp.height : ''}`;
                if (!Array.isArray(processedOptions[ignoreOrSelectBoxes][viewport])) processedOptions[ignoreOrSelectBoxes][viewport] = []

                let locators: Array<Locator> = [];
                let boxes: Array<Record<string, number>> = [];
                for (const selector of selectors) {
                    let l = await page.locator(selector).all()
                    if (l.length === 0) {
                        optionWarnings.add(`for snapshot ${snapshot.name}, no element found with selector/xpath ${selector}`);
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
        
                processedOptions[ignoreOrSelectBoxes][viewport].push(...boxes);
                await page.close();
            }
        }
    }

    return {
        processedSnapshot: {
            name: snapshot.name,
            url: snapshot.url,
            dom: Buffer.from(snapshot.dom.html).toString('base64'),
            options: processedOptions
        },
        warnings: [...optionWarnings, ...snapshot.dom.warnings]
    }
}
