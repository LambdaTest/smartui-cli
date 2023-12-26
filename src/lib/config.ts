import path from 'path'
import fs from 'fs'
import { WebConfigSchema, WebStaticConfigSchema } from '../types.js'

export const DEFAULT_WEB_STATIC_CONFIG: WebStaticConfigSchema = [
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

export const DEFAULT_WEB_CONFIG: WebConfigSchema = {
    web: {
        browsers: [
            'chrome',
            'firefox',
            'safari',
            'edge'
        ],
        viewports: [
            [1920, 1080],
            [1366, 768],
            [360, 640],
        ],
        waitForTimeout: 0,
    }
};

export function createWebConfig(filepath: string) {
    // default filepath
    filepath = filepath || 'smartui-web.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        console.log('Error: Config file must have .json extension');
        return
    }

    // verify the file does not already exist
    if (fs.existsSync(filepath)) {
        console.log(`Error: SmartUI Web Config already exists: ${filepath}`);
        console.log(`To create a new file, please specify the file name like: 'smartui config:create-web webConfig.json'`);
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(DEFAULT_WEB_CONFIG, null, 2) + '\n');
    console.log(`Created SmartUI Web Config: ${filepath}`);
};

export function createWebStaticConfig(filepath: string) {
    // default filepath
    filepath = filepath || 'url.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        console.log('Error: Config file must have .json extension');
        return
    }

    // verify the file does not already exist
    if (fs.existsSync(filepath)) {
        console.log(`Error: web-static config already exists: ${filepath}`);
        console.log(`To create a new file, please specify the file name like: 'smartui config:create-web links.json'`);
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(DEFAULT_WEB_STATIC_CONFIG, null, 2) + '\n');
    console.log(`Created web-static config: ${filepath}`);
};
