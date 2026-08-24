const { httpClient } = require('./httpClient.cjs');
var { constants } = require('./constants.cjs');
const fs = require('fs');
const { getLastCommit } = require('./git.cjs');

const MAX_RESOLUTIONS = 5
const MIN_RESOLUTION_WIDTH = 320
const MIN_RESOLUTION_HEIGHT = 320
const MAX_RESOLUTION_WIDTH = 7680
const MAX_RESOLUTION_HEIGHT = 7680

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

// Resolve PROJECT_NAME into a project token the same way the core CLI does, so
// `smartui storybook` accepts PROJECT_NAME (auto-creating the project) and is not
// limited to a pre-issued PROJECT_TOKEN.
async function resolveProjectToken(options) {
    const { PROJECT_NAME, LT_USERNAME, LT_ACCESS_KEY } = process.env;

    if (!LT_USERNAME || !LT_ACCESS_KEY) {
        console.log('[smartui] Error: PROJECT_NAME requires LT_USERNAME and LT_ACCESS_KEY to be set');
        process.exit(constants.ERROR_CATCHALL);
    }

    let response;
    try {
        response = await httpClient.get(constants[options.env].TOKEN_VERIFY_URL, {
            headers: {
                projectName: PROJECT_NAME,
                userName: LT_USERNAME,
                accessKey: LT_ACCESS_KEY
            }
        });
    } catch (error) {
        const errorMsg = error.response
            ? (error.response.data && error.response.data.message) || error.message
            : error.message;
        console.log(`[smartui] Error: Cannot resolve PROJECT_NAME '${PROJECT_NAME}'. Error: `, errorMsg);
        process.exit(constants.ERROR_CATCHALL);
    }

    const body = (response.data && response.data.data) || response.data || {};
    if (!body.projectToken) {
        console.log(`[smartui] Error: Cannot resolve PROJECT_NAME '${PROJECT_NAME}'; project token not received`);
        process.exit(constants.ERROR_CATCHALL);
    }

    process.env.PROJECT_TOKEN = body.projectToken;
    if (body.message && body.message.includes('Project created successfully')) {
        console.log(`[smartui] Project '${PROJECT_NAME}' created`);
    }
    console.log(`[smartui] Resolved PROJECT_NAME '${PROJECT_NAME}' to a project token`);
}

async function validateProjectToken(options) {
    if (!process.env.PROJECT_TOKEN && process.env.PROJECT_NAME) {
        await resolveProjectToken(options);
    }

    if (process.env.PROJECT_TOKEN) {
        return httpClient.get(constants[options.env].AUTH_URL, {
            headers: {
                projectToken: process.env.PROJECT_TOKEN
            }
        })
            .then(function (response) {
                console.log('[smartui] Project Token Validated');
            })
            .catch(function (error) {
                if (error.response) {
                    console.log('[smartui] Error: Invalid Project Token');
                } else if (error.request) {
                    const errorMsg = error.code ? `${error.code}${error.message ? ' - ' + error.message : ''}` : (error.message || 'Unknown error');
                    console.log('[smartui] Project Token not validated. Error: ', errorMsg);
                } else {
                    const errorMsg = error.code ? `${error.code}${error.message ? ' - ' + error.message : ''}` : (error.message || 'Unknown error');
                    console.log('[smartui] Project Token not validated. Error: ', errorMsg);
                }
                process.exit(constants.ERROR_CATCHALL);
            });
    }

    console.log('[smartui] Error: No PROJECT_TOKEN or PROJECT_NAME set');
    process.exit(constants.ERROR_CATCHALL);
};

function validateStorybookUrl(url) {
    let aboutUrl;
    try {
        aboutUrl = new URL('?path=/settings/about', url).href;
    } catch (error) {
        console.log('[smartui] Error: ', error.message)
        process.exit(constants.ERROR_CATCHALL);
    }
    return httpClient.get(aboutUrl)
        .then(function (response) {
            console.log('[smartui] Connection to storybook established');
        })
        .catch(function (error) {
            if (error.response) {
                console.log('[smartui] Connection to storybook not established. Error: ', error.message);
            } else if (error.request) {
                console.log('[smartui] Connection to storybook not established. Error: ', error.message);
            } else {
                console.log('[smartui] Connection to storybook not established. Error: ', error.message);
            }
            process.exit(constants.ERROR_CATCHALL);
        });
};

async function validateStorybookDir(dir) {
    // verify the directory exists
    if (!fs.existsSync(dir)) {
        console.log(`[smartui] Error: No directory found: ${dir}`);
        process.exit(constants.ERROR_CATCHALL);
    }
    // Verify project.json and stories.json exist to confirm it's a storybook-static dir
    if (!fs.existsSync(dir + '/index.html')) {
        console.log(`[smartui] Given directory is not a storybook static directory. Error: No index.html found`);
        process.exit(constants.ERROR_CATCHALL);
    }
    if (!fs.existsSync(dir + '/stories.json') && !fs.existsSync(dir + '/index.json')) {
        console.log(`[smartui] Given directory is not a storybook static directory. Error: stories.json or index.json not found`);
        process.exit(constants.ERROR_CATCHALL);
    }

};

async function validateLatestBuild(options) {
    let commit = await getLastCommit();

    // Build de-duplication keys off branch + commit. Outside a git repo there is nothing
    // to de-duplicate against, and sending empty keys makes the API reject the request with
    // an error that reads like an auth failure. Skip the check instead, matching how the
    // core CLI skips "Fetching git repo details" when it is not a git repo.
    if (!commit.branch || !commit.shortHash) {
        console.log('[smartui] Not a git repository; skipping duplicate-build check.');
        console.log('[smartui] Run inside a git repo to enable build de-duplication by branch and commit.');
        return;
    }

    return httpClient.get(new URL(constants[options.env].SB_BUILD_VALIDATE_PATH, constants[options.env].BASE_URL).href, {
        headers: {
            projectToken: process.env.PROJECT_TOKEN
        },
        params: {
            branch: commit.branch,
            commitId: commit.shortHash
        }
    })
        .then(function (response) {
            if (response.data.status === 'Failure') {
                console.log(`[smartui] Build with commit '${commit.shortHash}' on branch '${commit.branch}' already exists.`);
                console.log('[smartui] Use option --force-rebuild to forcefully push a new build.');
                process.exit(constants.ERROR_BUILD_ALREADY_EXISTS);
            }
        })
        .catch(function (error) {
            // TODO: Add retries
            console.log('[smartui] Cannot fetch latest build of the project. Error: ', error.message);
            process.exit(constants.ERROR_CATCHALL);
        });
}

function validateConfig(configFile) {
    // Verify config file exists
    if (!fs.existsSync(configFile)) {
        console.log(`[smartui] Error: Config file ${configFile} not found.`);
        process.exit(constants.ERROR_CATCHALL);
    }

    // Parse JSON
    let storybookConfig;
    try {
        storybookConfig = JSON.parse(fs.readFileSync(configFile)).storybook;
    } catch (error) {
        console.log('[smartui] Error: ', error.message);
        process.exit(constants.ERROR_CATCHALL);
    }

    try {
        validateConfigBrowsers(storybookConfig.browsers);
        let resolutions = storybookConfig.resolutions || storybookConfig.viewports
        if (resolutions) {
            storybookConfig.resolutions = validateConfigResolutions(resolutions);
        }
        storybookConfig.viewports = storybookConfig.resolutions;
        let customViewports = storybookConfig.customViewports;
        if (customViewports && customViewports.length > 0) {
            validateCustomViewPorts(storybookConfig.customViewports)
        }
        if (!resolutions && (!customViewports || customViewports.length === 0)) {
            console.log('[smartui] Error: No resolutions or customViewports found in config file');
            process.exit(constants.ERROR_CATCHALL);
        }
    } catch (error) {
        console.log(`[smartui] Error: Invalid config, ${error.message}`);
        process.exit(constants.ERROR_CATCHALL);
    }

    // Sanity check waitForTimeout
    if (!Object.hasOwn(storybookConfig, 'waitForTimeout')) {
        storybookConfig.waitForTimeout = 0;
    } else if (storybookConfig.waitForTimeout <= 0 || storybookConfig.waitForTimeout > 300000) {
        console.log('[smartui] Warning: Invalid config, value of waitForTimeout must be > 0 and <= 300000');
        console.log('[smartui] If you do not wish to include waitForTimeout parameter, remove it from the config file.');
        storybookConfig.waitForTimeout = 0;
    }

    return storybookConfig
}

function validateTunnel(configFile) {
    // Verify config file exists
    if (!fs.existsSync(configFile)) {
        console.log(`[smartui] Error: Config file ${configFile} not found.`);
        process.exit(constants.ERROR_CATCHALL);
    }

    let tunnelConfig;
    try {
        let config = JSON.parse(fs.readFileSync(configFile));
        tunnelConfig = config.tunnel || {};
        if (tunnelConfig && tunnelConfig.type && tunnelConfig.type != "manual")  {
            throw new ValidationError('Invalid tunnel type. Accepted type is `manual` only');
        }
    } catch (error) {
        console.log('[smartui] Error: ', error.message);
        process.exit(constants.ERROR_CATCHALL);
    }

    return tunnelConfig
}

function validateConfigBrowsers(browsers) {
    if (browsers.length == 0) {
        throw new ValidationError('empty browsers list.');
    }
    const set = new Set();
    for (let element of browsers) {
        if (!constants.VALID_BROWSERS.includes(element.toLowerCase()) || set.has(element)) {
            throw new ValidationError(`invalid or duplicate value for browser. Accepted browsers are ${constants.VALID_BROWSERS.join(',')}`);
        }
        set.add(element);
    };
}

function validateConfigResolutions(resolutions) {
    if (!Array.isArray(resolutions)) {
        throw new ValidationError('Invalid viewports config. Please add atleast one viewport.');
    }
    if (resolutions.length == 0) {
        throw new ValidationError('Empty viewports list in config.');
    }
    if (resolutions.length > 5) {
        throw new ValidationError(`max resolutions: ${MAX_RESOLUTIONS}`);
    }
    let res = [];
    resolutions.forEach(element => {
        if (!Array.isArray(element) || element.length == 0 || element.length > 2) {
            throw new ValidationError('Invalid elements in viewports config.');
        }
        let width = element[0];
        let height = element[1];
        if (typeof width != 'number') {
            width = Number(width);
        }
        if (typeof height != 'number') {
            height = Number(height);
        }
        if (width && width < MIN_RESOLUTION_WIDTH || width > MAX_RESOLUTION_WIDTH) {
            throw new ValidationError(`width must be > ${MIN_RESOLUTION_WIDTH}, < ${MAX_RESOLUTION_WIDTH}`);
        }
        if (height && (height < MIN_RESOLUTION_HEIGHT|| height > MAX_RESOLUTION_HEIGHT)) {
            throw new ValidationError(`height must be > ${MIN_RESOLUTION_HEIGHT}, < ${MAX_RESOLUTION_HEIGHT}`);
        }
        res.push([width, height || 0]);
    });

    return res
}


function validateCustomViewPorts(customViewports) {
    if (!Array.isArray(customViewports)) {
        return
    }
    if (customViewports && customViewports.length == 0) {
        return
    }
    customViewports.forEach(element => {
        if (element.stories && element.stories.length !== 0 && element.exclude && element.exclude.length !== 0) {
            throw new ValidationError('Cannot specify both stories and excludeStories in customViewports');
        }
        if (element.styles) {
            if (!element.styles?.width) {
                throw new ValidationError('Missing width in styles. please check the config file');
            }
            let width = element.styles.width;
            let height = element.styles.height;
            if (width && typeof width != 'number') {
                width = Number(width);
            }
            if (height && typeof height != 'number') {
                height = Number(height);
            }
            if (width && width < MIN_RESOLUTION_WIDTH || width > MAX_RESOLUTION_WIDTH) {
                throw new ValidationError(`customViewports.styles width must be > ${MIN_RESOLUTION_WIDTH}, < ${MAX_RESOLUTION_WIDTH}`);
            }
            if (height && (height < MIN_RESOLUTION_HEIGHT || height > MAX_RESOLUTION_HEIGHT)) {
                throw new ValidationError(`customViewports.styles height must be > ${MIN_RESOLUTION_HEIGHT}, < ${MAX_RESOLUTION_HEIGHT}`);
            }
            element.styles.width = width;
            element.styles.height = height;
        } else {
            if (!element.waitForTimeout) {
                throw new ValidationError('Missing styles and waitForTimeout. Specify either of them. please check the config file');
            }
        }

    });
    return
}

module.exports = {
    ValidationError,
    validateProjectToken,
    validateStorybookUrl,
    validateStorybookDir,
    validateLatestBuild,
    validateConfig,
    validateConfigBrowsers,
    validateConfigResolutions,
    validateCustomViewPorts,
    validateTunnel,
};
