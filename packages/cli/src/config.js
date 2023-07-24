import fs from 'fs';
import { ABNORMAL_EXIT } from './constant.js';
import path from 'path';

export const defaultScreenshotConfig = [
    {
        "name": "lambdatest-home-page",
        "url": "https://www.lambdatest.com",
        "waitForTimeout": 1000
    },
    {
        "name": "example-page",
        "url": "https://example.com/"
    }
]

export const defaultSmartUIWebConfig = {
    web: {
        browsers: [
            'chrome',
            'firefox',
            'safari',
            'edge'
        ],
        resolutions: [
            [1920, 1080],
            [1366, 768],
            [360, 640],
        ]
    }
};

export function createWebConfig(filepath, log) {
    // default filepath
    filepath = filepath || 'smartui-web.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        log.error(`Error: Web Config file must have .json extension`);
        process.exitCode = ABNORMAL_EXIT;
        return
    }

    // verify the file does not already exist
    if (fs.existsSync(filepath)) {
        log.error(`Error: SmartUI Web Config already exists: ${filepath}`);
        log.error(`To create a new file, please specify the file name like: 'smartui config:create-web webConfig.json'`);
        process.exitCode = ABNORMAL_EXIT;
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(defaultSmartUIWebConfig, null, 2) + '\n');
    log.info(`Created SmartUI Web Config: ${filepath}`);
};

export function createWebStaticConfig(filepath, log) {
    // default filepath
    filepath = filepath || 'url.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        log.error(`Error: Config file must have .json extension`);
        process.exitCode = ABNORMAL_EXIT;
        return
    }

    // verify the file does not already exist
    if (fs.existsSync(filepath)) {
        log.error(`Error: web-static config already exists: ${filepath}`);
        log.error(`To create a new file, please specify the file name like: 'smartui config:create-web links.json'`);
        process.exitCode = ABNORMAL_EXIT;
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(defaultScreenshotConfig, null, 2) + '\n');
    log.info(`Created web-static config: ${filepath}`);
};