import { Snapshot, Context, ProcessedSnapshot } from "../types.js";
import { chromium, Locator } from "@playwright/test"

const MIN_VIEWPORT_HEIGHT = 1080;

export default async (snapshot: Snapshot, ctx: Context): Promise<ProcessedSnapshot> => {
    // Process snapshot options
    let options = snapshot.options;
    let processedOptions: Record<string, any> = {};
    if (options && Object.keys(options).length !== 0) {
        ctx.log.debug(`Processing options: ${JSON.stringify(options)}`);
        
        if ((options.ignoreDOM && Object.keys(options.ignoreDOM).length !== 0) || (options.selectDOM && Object.keys(options.selectDOM).length !== 0)) {
            if (!ctx.browser) ctx.browser = await chromium.launch({ headless: true });
            const page = await ctx.browser.newPage();
            await page.setContent(snapshot.dom.html);
    
            let ignoreOrSelectDOM: string;
            let ignoreOrSelectBoxes: string;
            if (options.ignoreDOM && Object.keys(options.ignoreDOM).length !== 0) {
                processedOptions.ignoreBoxes = {};
                ignoreOrSelectDOM = 'ignoreDOM';
                ignoreOrSelectBoxes = 'ignoreBoxes';
            } else {
                processedOptions.selectBoxes = {};
                ignoreOrSelectDOM = 'selectDOM';
                ignoreOrSelectBoxes = 'selectBoxes';
            }

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
                    case 'cssSelectors':
                        selectors.push(...value);
                        break;
                }
            }
    
            for (const vp of ctx.webConfig.viewports) {
                await page.setViewportSize({ width: vp.width, height: vp.height || MIN_VIEWPORT_HEIGHT});
                let viewport: string = `${vp.width}${vp.height ? 'x'+vp.height : ''}`;
                if (!Array.isArray(processedOptions[ignoreOrSelectBoxes][viewport])) processedOptions[ignoreOrSelectBoxes][viewport] = []

                let locators: Array<Locator> = [];
                let boxes: Array<Record<string, number>> = [];
                for (const selector of selectors) {
                    let l = await page.locator(selector).all()
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
            }
        }
    }

    return {
        name: snapshot.name,
        url: snapshot.url,
        dom: Buffer.from(snapshot.dom.html).toString('base64'),
        options: processedOptions
    }
}
