const { httpClient } = require('./httpClient.cjs');
const fs = require('fs');
const path = require('path')
const formData = require('form-data');
const { JSDOM } = require("jsdom");
var { constants } = require('./constants.cjs');
const { getLastCommit } = require('./git.cjs');
const { shortPolling } = require('./polling.cjs');
const puppeteer = require('puppeteer');

async function sendDoM(storybookUrl, stories, storybookConfig, options) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
    } catch (error) {
        // The usual cause is a missing Chromium download: package managers that skip
        // install scripts (pnpm >= 10 by default) never run puppeteer's postinstall,
        // so launch times out waiting for a browser that was never fetched.
        console.log('[smartui] Error: Cannot launch the browser used to capture stories.');
        console.log('[smartui] Error: ', error.message.split('\n')[0]);
        console.log("[smartui] If Chromium is missing, install it with 'npx puppeteer browsers install chrome'.");
        process.exit(constants.ERROR_CATCHALL);
    }

    if (!fs.existsSync('doms')){
        fs.mkdir('doms', (err) => {
            if (err) {
                console.error(err);
                process.exit(constants.ERROR_CATCHALL);
            }
        });
    }
    for (const [storyId, storyInfo] of Object.entries(stories)) {
        const page = await browser.newPage();
        await page.goto(storyInfo.url, { waitUntil: 'networkidle0' });
        const html = await page.content();

        const dom = new JSDOM(html, {
            url: storybookUrl,
            resources: 'usable'
        });
        const clone = new JSDOM(html);

        // Serialize DOM
        for(const element of clone.window.document.querySelectorAll('img')) {
            let image = new URL(element.getAttribute('src'), storybookUrl).href;
            let format = path.extname(image).replace(/^./, '');
            format = format === 'svg' ? 'svg+xml' : format
            let imageAsBase64 = await getBase64(image);
            element.setAttribute('src', 'data:image/'+format+';base64,'+imageAsBase64);
        }
        await serializeCSSOM(dom, clone);

        try {
            fs.writeFileSync('doms/' + storyId + '.html', clone.serialize());
        } catch (err) {
            console.error(err);
        }

        await page.close();
    }
    await browser.close()

    // Create form
    let commit = await getLastCommit();
    const form = new formData();
    for (const [storyId, storyInfo] of Object.entries(stories)) {
        const file = fs.readFileSync('doms/' + storyId + '.html');
        let title = storyInfo.kind || storyInfo.title;
        title = title ? title.replaceAll('/', '#')+': ' : '';
        let filename = title + storyInfo.name;
        form.append('files', file, filename+'.html');
    }
    form.append('resolution', storybookConfig.resolutions);
    form.append('browser', storybookConfig.browsers);
    form.append('projectToken', process.env.PROJECT_TOKEN);
    form.append('branch', commit.branch);
    form.append('commitId', commit.shortHash);
    form.append('commitAuthor', commit.author.name);
    form.append('commitMessage', commit.subject);
    form.append('customViewports', JSON.stringify(storybookConfig.customViewports));
    let githubURL = process.env.GITHUB_URL
    if (githubURL) {
       form.append('githubURL', githubURL);
    }

    // Send DOM to render API
    await httpClient.post(constants[options.env].RENDER_API_URL, form, {
        headers: {
            ...form.getHeaders()
        }
        })
        .then(async function (response) {
            console.log('[smartui] Build URL: ', response.data.buildURL);
            console.log('[smartui] Build in progress...');
            await shortPolling(response.data.buildId, 0, options);
        })
        .catch(function (error) {
            if (error.response) {
                console.log('[smartui] Build failed: Error: ', error.response.data.message);
            } else {
                console.log('[smartui] Build failed: Error: ', error.message);
            }       
        });
    
    fs.rm('doms', {recursive: true}, (err) => {
        if (err) {
            return console.error(err);
        }
    });
};

function getBase64(url) {
    return httpClient.get(url, {
            responseType: "text",
            responseEncoding: "base64",
        })
        .then(response => response.data)
        .catch(function (error) {
            console.log('[smartui] Error: ', error.message);
            process.exit(constants.ERROR_CATCHALL);
        });
}

async function serializeCSSOM(dom, clone) {
    return new Promise(resolve => {
        dom.window.addEventListener("load", () => {
            for (let styleSheet of dom.window.document.styleSheets) {
                let style = clone.window.document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = Array.from(styleSheet.cssRules)
                    .map(cssRule => cssRule.cssText).join('\n');
                clone.window.document.head.appendChild(style);
            }
            resolve();
        });
    });
}

module.exports = { sendDoM };
