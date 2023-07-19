import { generateId } from './utils.js';
import playwright from 'playwright';
import FormData from 'form-data';
import fs from 'fs';
import { constants } from './constants.js';


export async function screenshot(client, build, options, log) {
    log.debug("process screenshot started")
    let { screenshots } = options;
    for (const screenshot of screenshots) {
        if (screenshots.indexOf(screenshot) === screenshots.length - 1) {
            options.lastScreenshot = true
        }
        log.debug(screenshot)
        let id = generateId(screenshot.name)
        log.debug(id)
        screenshot.id = id
        await captureScreenshots(client, screenshot, build, options, log);
    }
}

async function captureScreenshots(client, screenshot, build, options, log) {
    log.debug("captureScreenshots")
    try {
        const browsers = [];
        const viewports = [];
        log.debug(options)
        let { config } = options;
        let webConfig = config.web;
        log.debug(webConfig)

        webConfig.browsers.forEach(element => {
            browsers.push(element.toLowerCase());
        });

        webConfig.resolutions.forEach(element => {
            viewports.push({ width: element[0], height: element[1] });
        });
        log.debug(browsers)
        log.debug(viewports)

        log.info("Navigating URL : " + screenshot.url)

        for (const browserName of browsers) {
            log.debug("Processing for browser : " + browserName)
            let btype;
            let launchOptions = { headless: true };
            if (browserName == constants.CHROME) {
                btype = constants.CHROMIUM;
            } else if (browserName == constants.SAFARI) {
                btype = constants.WEBKIT;
            } else if (browserName == constants.EDGE) {
                btype = constants.CHROMIUM;
                launchOptions.channel = constants.EDGE_CHANNEL;
            } else {
                btype = browserName;
            }

            log.debug(launchOptions)
            const browser = await playwright[btype].launch(launchOptions);
            const context = await browser.newContext();
            const page = await context.newPage();
            log.debug("waitForTimeout : " + screenshot.waitForTimeout)

            await page.goto(screenshot.url);
            let lastBrowser = false
            if (browsers.indexOf(browserName) === browsers.length - 1) {
                lastBrowser = true
            }

            if (screenshot.waitForTimeout) {
                log.debug("waitForTimeout : " + screenshot.waitForTimeout)
                // Add the wait timeout
                await page.waitForTimeout(screenshot.waitForTimeout);
            }

            for (const viewport of viewports) {

                let lastViewport = false
                if (viewports.indexOf(viewport) === viewports.length - 1) {
                    lastViewport = true
                }

                await page.setViewportSize(viewport);
                const { width, height } = viewport;
                const spath = `screenshots/${screenshot.id}/${browserName}-${width}x${height}-${screenshot.id}.png`
                await page.screenshot({ path: spath, fullPage: true });

                let payload = {
                    spath: spath,
                    browser: browserName,
                    resolution: `${width}x${height}`
                }
                if (lastViewport && lastBrowser && options.lastScreenshot) {
                    payload.completed = true;
                }

                upload(client, screenshot, build, options, log, payload)
            }

            await browser.close();
        }
        log.debug('Screenshots captured successfully.');
    } catch (error) {
        log.error('Error capturing screenshots:');
        log.error(error)
    }
}


async function upload(client, screenshot, build, options, log, payload) {
    log.debug("Upload screenshot started")
    log.debug(screenshot)
    log.debug(payload)

    const form = new FormData();

    const file = fs.readFileSync(payload.spath);
    form.append('screenshots', file, `${screenshot.name}.png`);

    // form.append('projectToken', process.env.PROJECT_TOKEN);
    form.append('browser', payload.browser);
    form.append('resolution', payload.resolution);
    form.append('buildId', build.buildId);
    form.append('buildName', build.buildName);
    form.append('screenshotName', screenshot.name);
    if (build.baseline) {
        form.append('baseline', "true");
    }
    if (payload && payload.completed) {
        form.append('completed', "true");
    }
    await client.upload(form, payload)
}

