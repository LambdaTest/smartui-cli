import { Snapshot, Context, ProcessedSnapshot } from "../types.js";
import { chromium, Locator } from "@playwright/test"

const MIN_VIEWPORT_HEIGHT = 1080;

export default async (snapshot: Snapshot, ctx: Context): Promise<Record<string, any>> => {
    // Process snapshot options
    let options = snapshot.options;
    let optionWarnings: Set<string> = new Set();
    let processedOptions: Record<string, any> = {};
    if (options && Object.keys(options).length !== 0) {
        ctx.log.debug(`Processing options: ${JSON.stringify(options)}`);
        
        const isNotAllEmpty = (obj: Record<string, Array<string>>): boolean => {
            for (let key in obj) if (obj[key]?.length) return true;
            return false;
        }

        let ignoreOrSelectDOM: string;
        let ignoreOrSelectBoxes: string;
        if (options.ignoreDOM && Object.keys(options.ignoreDOM).length && isNotAllEmpty(options.ignoreDOM)) {
            processedOptions.ignoreBoxes = {};
            ignoreOrSelectDOM = 'ignoreDOM';
            ignoreOrSelectBoxes = 'ignoreBoxes';
        } else if (options.selectDOM && Object.keys(options.selectDOM).length && isNotAllEmpty(options.selectDOM)) {
            processedOptions.selectBoxes = {};
            ignoreOrSelectDOM = 'selectDOM';
            ignoreOrSelectBoxes = 'selectBoxes';
        }

        if (ignoreOrSelectDOM) {
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
    
            for (const vp of ctx.webConfig.viewports) {
                const page = await ctx.browser.newPage({ viewport: { width: vp.width, height: vp.height || MIN_VIEWPORT_HEIGHT}});
                await page.setContent(snapshot.dom.html);

                let viewport: string = `${vp.width}${vp.height ? 'x'+vp.height : ''}`;
                if (!Array.isArray(processedOptions[ignoreOrSelectBoxes][viewport])) processedOptions[ignoreOrSelectBoxes][viewport] = []

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
