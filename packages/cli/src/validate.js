import fs from 'fs';
import { ABNORMAL_EXIT, VALID_BROWSERS, MAX_RESOLUTIONS, MAX_RESOLUTION_WIDTH, MAX_RESOLUTION_HEIGHT, MIN_RESOLUTION_WIDTH, MIN_RESOLUTION_HEIGHT } from './constant.js';
import { URL } from 'url';
import { defaultSmartUIWebConfig } from './config.js'


// Parse the JSON data
export function parse(file) {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data);
}

export function validateScreenshotConfig(configFile, options, log) {
    log.info(`file :  ${configFile}`)

    // Check if file exists
    if (Object.keys(configFile).length) {
        try {
            fs.promises.access(configFile);
        } catch (error) {
            log.error(`Error: Either File does not exist ${configFile} or doesn't have read permissions. Trace : ${error}`);
            log.debug(error)
            process.exit(ABNORMAL_EXIT);
        }
    }


    let screenshots = {};
    // Check JSON Parse Error
    if (Object.keys(configFile).length) {
        try {
            screenshots = parse(configFile)
        } catch (error) {
            log.error('Error: Invalid file, capture command only supports json file');
            process.exit(ABNORMAL_EXIT);
        }
    }

    log.debug(screenshots)

    //Check for URLs should not be empty
    for (const screenshot of screenshots) {
        if (!screenshot.name || screenshot.name == '') {
            log.error(`Error: Missing screenshot name in ${configFile}`);
            process.exit(ABNORMAL_EXIT);
        }
        if (!screenshot.url || screenshot.url == '') {
            log.error('Error: Missing required URL for screenshot : '+screenshot.name);
            process.exit(ABNORMAL_EXIT);
        }
        //Check for URLs should valid (like abcd in URL)
        try {
            new URL(screenshot.url);
        } catch (error) {
            log.error('Error: Invalid screenshot URL: ' + screenshot.url);
            process.exit(ABNORMAL_EXIT);
        }
    }

    log.debug(options)

    //Check for smartui-web.json
    let webConfigFile = options.config
    // Verify config file exists
    if (!fs.existsSync(webConfigFile)) {
        log.error(`Error: Config file not found, will use default configs`);
        return defaultSmartUIWebConfig
    }

    // Parse JSON
    let webConfig;
    try {
        webConfig = JSON.parse(fs.readFileSync(webConfigFile));
    } catch (error) {
        log.error('Error: ', error.message);
        process.exit(ABNORMAL_EXIT);
    }
    if (webConfig && webConfig.web) {
        try {
            validateConfigBrowsers(webConfig.web.browsers);
            webConfig.web.resolutions = validateConfigResolutions(webConfig.web.resolutions);
        } catch (error) {
            log.error(`Error: Invalid webConfig, ${error.message}`);
            process.exit(ABNORMAL_EXIT);
        }
        return webConfig
    } else {
        log.error(`No webConfig found in ${webConfigFile} file, will use default configs`);
        return defaultSmartUIWebConfig
    }
}


function validateConfigBrowsers(browsers) {
    if (browsers.length == 0) {
        throw new ValidationError('empty browsers list.');
    }
    const set = new Set();
    for (let element of browsers) {
        if (!VALID_BROWSERS.includes(element.toLowerCase()) || set.has(element)) {
            throw new ValidationError(`invalid or duplicate value for browser. Accepted browsers are ${VALID_BROWSERS.join(',')}`);
        }
        set.add(element);
    };
}

function validateConfigResolutions(resolutions) {
    if (!Array.isArray(resolutions)) {
        throw new ValidationError('invalid resolutions.');
    }
    if (resolutions.length == 0) {
        throw new ValidationError('empty resolutions list in config.');
    }
    if (resolutions.length > 5) {
        throw new ValidationError(`max resolutions: ${MAX_RESOLUTIONS}`);
    }
    let res = [];
    resolutions.forEach(element => {
        if (!Array.isArray(element) || element.length == 0 || element.length > 2) {
            throw new ValidationError('invalid resolutions.');
        }
        let width = element[0];
        let height = element[1];
        if (typeof width != 'number' || width < MIN_RESOLUTION_WIDTH || width > MAX_RESOLUTION_WIDTH) {
            throw new ValidationError(`width must be > ${MIN_RESOLUTION_WIDTH}, < ${MAX_RESOLUTION_WIDTH}`);
        }
        if (height && (typeof height != 'number' || height < MIN_RESOLUTION_WIDTH || height > MAX_RESOLUTION_WIDTH)) {
            throw new ValidationError(`height must be > ${MIN_RESOLUTION_HEIGHT}, < ${MAX_RESOLUTION_HEIGHT}`);
        }
        res.push([width, height || 0]);
    });

    return res
}
