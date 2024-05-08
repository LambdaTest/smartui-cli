import path from 'path'
import fs from 'fs'
import constants from './constants.js';

export function createConfig(filepath: string) {
    // default filepath
    filepath = filepath || '.smartui.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        console.log('Error: Config file must have .json extension');
        return
    }

    // verify the file does not already exist
    if (fs.existsSync(filepath)) {
        console.log(`Error: SmartUI Config already exists: ${filepath}`);
        console.log(`To create a new file, please specify the file name like: 'smartui config:create .smartui-config.json'`);
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(constants.DEFAULT_CONFIG, null, 2) + '\n');
    console.log(`Created SmartUI Config: ${filepath}`);
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
        console.log(`To create a new file, please specify the file name like: 'smartui config:create-web-static links.json'`);
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(constants.DEFAULT_WEB_STATIC_CONFIG, null, 2) + '\n');
    console.log(`Created web-static config: ${filepath}`);
};

export function createFigmaConfig(filepath: string) {
    // default filepath
    filepath = filepath || 'designs.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        console.log('Error: designs config file must have .json extension');
        return
    }

    // verify the file does not already exist
    if (fs.existsSync(filepath)) {
        console.log(`Error: designs config already exists: ${filepath}`);
        console.log(`To create a new file, please specify the file name like: 'smartui config:figma-config designs.json'`);
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(constants.DEFAULT_FIGMA_CONFIG, null, 2) + '\n');
    console.log(`Created designs config: ${filepath}`);
};
