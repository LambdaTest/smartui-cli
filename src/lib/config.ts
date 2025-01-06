import path from 'path'
import fs from 'fs'
import constants from './constants.js';
import { Context } from "../types.js";

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

export function createWebFigmaConfig(filepath: string) {
    // default filepath
    filepath = filepath || '.smartui.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        console.log('Error: figma config file must have .json extension');
        return
    }

    // verify the file does not already exist
    if (fs.existsSync(filepath)) {
        console.log(`Error: figma config already exists: ${filepath}`);
        console.log(`To create a new file, please specify the file name like: 'smartui config:create-figma-web <fileName>.json'`);
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(constants.WEB_FIGMA_CONFIG, null, 2) + '\n');
    console.log(`Created figma web config: ${filepath}`);
};

export function verifyFigmaWebConfig(ctx: Context) {
    if (ctx.env.FIGMA_TOKEN == "") {
        throw new Error("Missing FIGMA_TOKEN in Environment Variables");
    }
    if (ctx.env.LT_USERNAME == "") {
        throw new Error("Missing LT_USERNAME in Environment Variables");
    }
    if (ctx.env.LT_ACCESS_KEY == "") {
        throw new Error("Missing LT_ACCESS_KEY in Environment Variables");
    }
    let figma = ctx.config && ctx.config?.figma || {};
    const screenshots = [];
    for (let c of figma?.configs) {
        if (c.screenshot_names && c.screenshot_names.length > 0 && c.figma_ids && c.figma_ids.length != c.screenshot_names.length) {
            throw new Error("Mismatch in Figma Ids and Screenshot Names in figma config");
        }
        if (isValidArray(c.screenshot_names)) {
            for (const name of c.screenshot_names) {
                screenshots.push(name);
            }
        }
    }

    if (new Set(screenshots).size !== screenshots.length) {
        throw new Error("Found duplicate screenshot names in figma config");
    }

    return true;
};

function isValidArray(input) {
    return Array.isArray(input) && input.length > 0;
}