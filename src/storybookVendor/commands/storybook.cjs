const { httpClient } = require('./utils/httpClient.cjs')
const fs = require('fs')
const { sendDoM } = require('./utils/dom.cjs')
const { validateStorybookUrl, validateStorybookDir } = require('./utils/validate.cjs')
const { defaultSmartUIConfig } = require('./utils/config.cjs')
const { skipStory } = require('./utils/story.cjs')
const { getLastCommit } = require('./utils/git.cjs')
const staticUtils = require('./utils/static.cjs')
var { constants } = require('./utils/constants.cjs');
const { shortPolling } = require('./utils/polling.cjs');

// Storybook >= 8 dropped stories.json in favour of index.json (entries keyed by story id).
// Try the modern file first and fall back to the legacy one so both generations work.
async function fetchStoryIndex(url) {
    const candidates = ['index.json', 'stories.json'];
    let lastError;

    for (const file of candidates) {
        let response;
        try {
            response = await httpClient.get(new URL(file, url).href);
        } catch (error) {
            lastError = error;
            continue;
        }

        const data = response && response.data ? response.data : {};
        const entries = data.entries || data.stories;
        if (entries && Object.keys(entries).length) {
            return { entries, source: file };
        }
        lastError = new Error(`${file} did not contain any stories`);
    }

    throw lastError || new Error(`neither ${candidates.join(' nor ')} could be read from ${url}`);
}

async function storybook(serve, options) {
    let type = /^https?:\/\//.test(serve) ? 'url' : 'dir';
    let storybookConfig = options.config ? options.config : defaultSmartUIConfig.storybook;
    const buildName = options.buildName? options.buildName : "";

    if (type === 'url') {
        await validateStorybookUrl(serve);
        let url = serve;

        // Convert browsers and resolutions arrays to string
        let resolutions = [];
        (storybookConfig.resolutions || storybookConfig.viewports || []).forEach(element => {
            resolutions.push(element.join('x'));
        });
        storybookConfig.resolutions = (!resolutions.length) ? 'all' : resolutions.toString();
        storybookConfig.browsers = (!storybookConfig.browsers.length) ? 'all' : storybookConfig.browsers.map(x => x.toLowerCase()).toString();

        // Get the story index and add url corresponding to every story ID.
        // Storybook >= 8 serves index.json; older versions serve stories.json.
        let index;
        try {
            index = await fetchStoryIndex(url);
        } catch (error) {
            process.exitCode = constants.ERROR_CATCHALL;
            console.log('[smartui] Cannot fetch stories. Error: ', error.message);
            return;
        }
        console.log(`[smartui] Story index read from ${index.source}`);

        let stories = {}
        for (const [storyId, storyInfo] of Object.entries(index.entries)) {
            if (!skipStory(storyInfo, storybookConfig)) {
                stories[storyId] = {
                    name: storyInfo.name,
                    kind: storyInfo.kind || storyInfo.title,
                    url: new URL('/iframe.html?id=' + storyId + '&viewMode=story', url).href
                }
            }
        }

        if (Object.keys(stories).length === 0) {
            console.log('[smartui] Error: No stories found');
            process.exit(constants.ERROR_CATCHALL);
        }
        console.log('[smartui] Stories found: ', Object.keys(stories).length);
        console.log('[smartui] Number of stories rendered may differ based on the config file.');

        // Capture DoM of every story and send it to renderer API
        await sendDoM(url, stories, storybookConfig, options);
    } else {
        let dirPath = serve;
        await validateStorybookDir(dirPath);

        // Get storyIds to be rendered 
        let storyIds = staticUtils.filterStories(dirPath, storybookConfig)
        let maxStories = storybookConfig.chunkSize || 100;
        let lazyLoadedStories = [];
        if (Array.isArray(storybookConfig.lazyLoadedStories) && storybookConfig.lazyLoadedStories.length > 0) {
            lazyLoadedStories = storybookConfig.lazyLoadedStories;
        }
        let useGlobals = false;
        let backgroundTheme = storybookConfig.backgroundTheme || 'light';
        if (storybookConfig.backgroundTheme && ['light', 'dark'].includes(storybookConfig.backgroundTheme.toLowerCase())) {
            useGlobals = true;
            backgroundTheme = storybookConfig.backgroundTheme.toLowerCase();
        }

        if (storybookConfig.useGlobals === true || storybookConfig.backgroundTheme == undefined) {
            useGlobals = true;
            backgroundTheme = 'light';
        }

        // Upload Storybook static
        await staticUtils.getSignedUrl(options)
            .then(async function (response) {
                let { url, uploadId } = response.data.data;

                // Compress static build
                await staticUtils.compress(dirPath, uploadId)
                    .then(function () {
                        console.log(`[smartui] ${dirPath} compressed.`)
                    })
                    .catch(function (err) {
                        console.log(`[smartui] Cannot compress ${dirPath}. Error: ${err.message}`);
                        process.exit(constants.ERROR_CATCHALL);
                    });

                // Upload to S3
                const zipData = fs.readFileSync('storybook-static.zip');
                console.log('[smartui] Upload in progress...')
                await httpClient.put(url, zipData, {
                    headers: {
                        'Content-Type': 'application/zip',
                        'Content-Length': zipData.length
                    }})
                    .then(function (response) {
                        console.log(`[smartui] ${dirPath} uploaded.`);
                        fs.rmSync('storybook-static.zip');
                    })
                    .catch(function (error) {
                        console.log(`[smartui] Cannot upload ${dirPath}. Error: ${error.message}`);
                        fs.rmSync('storybook-static.zip');
                        process.exit(constants.ERROR_CATCHALL);
                    });

                // Prepare payload data
                let browsers = []
                let resolutions = []

                storybookConfig.browsers.forEach(element => {
                    browsers.push(element.toLowerCase());
                });
                let rs = storybookConfig.resolutions || storybookConfig.viewports
                if (rs && rs.length){
                    rs.forEach(element => {
                        resolutions.push({ width: element[0], height: element[1] });
                    });
                }

                let commit = await getLastCommit();
                let baseLine = process.env.BASELINE_BRANCH;
                let currentBranch = process.env.CURRENT_BRANCH;
                if (baseLine !== null && baseLine !== undefined){
                    if(baseLine === ''){
                        const error = {
                            "error": "MISSING_BRANCH_NAME",
                            "message": "Error : The baseline branch name environment variable cannot be empty."
                        };
                        console.log(JSON.stringify(error, null, 2));
                        process.exit(1);
                    }
                }
                    
                if(currentBranch !== null && currentBranch !==undefined){
                    if(currentBranch === ''){
                        const error = {
                            "error": "MISSING_BRANCH_NAME",
                            "message": "Error : The current branch name environment variable cannot be empty."
                        };
                        console.log(JSON.stringify(error, null, 2));
                        process.exit(1);
                    }
                }
                let payload = {
                    downloadURL: url.substring(url.search(/.com/)+5, url.search(/.zip/)+4),
                    uploadId: uploadId,
                    projectToken: process.env.PROJECT_TOKEN,
                    storybookConfig: {
                        browsers: browsers,
                        resolutions: resolutions,
                        storyIds: storyIds,
                        waitForTimeout: storybookConfig.waitForTimeout,
                        customViewports: storybookConfig.customViewports,
                        useOnlyCustomViewports: storybookConfig.useOnlyCustomViewports,
                        lazyLoadedStories: lazyLoadedStories,
                        useGlobals: useGlobals,
                        backgroundTheme: backgroundTheme
                    },
                    git: {
                        branch: currentBranch || commit.branch|| '',  
                        baselineBranch: baseLine || '',
                        commitId: commit.shortHash, 
                        commitAuthor: commit.author.name, 
                        commitMessage: commit.subject, 
                        githubURL: process.env.GITHUB_URL || '',
                    },
                    buildName: buildName,
                    tunnel: options.tunnel || {},
                    maxStories: maxStories
                }

                // Call static render API
                await httpClient.post(new URL(constants[options.env].STATIC_RENDER_PATH, constants[options.env].BASE_URL).href, payload)
                    .then(async function (response) {
                        if (response.data && response.data.error) {
                            console.log('[smartui] Error: ', response.data.error.message);
                            process.exitCode = constants.ERROR_CATCHALL;
                            return
                        }
                        console.log('[smartui] Build URL: ', response.data.data.buildURL);
                        console.log('[smartui] Build in progress...');
                        await shortPolling(response.data.data.buildId, 0, options);
                    })
                    .catch(function (error) {
                        if (error.response) {
                            console.log('[smartui] Build failed: Error: ', error.response.data.error?.message);
                        } else {
                            console.log('[smartui] Build failed: Error: ', error.message);
                        }
                        process.exitCode = constants.ERROR_CATCHALL;
                    });
            })
            .catch(function (error) {
                if (error.response) {
                    console.log('[smartui] Error: ', error.response.data.error?.message);
                } else {
                    console.log('[smartui] Error: ', error.message);
                }
                process.exitCode = constants.ERROR_CATCHALL;
            });

    }
};

// fetchStoryIndex is exported for tests: it is the TE-24909 fix (Storybook >= 8 index.json
// discovery with a legacy stories.json fallback) and is worth covering directly.
module.exports = { storybook, fetchStoryIndex };