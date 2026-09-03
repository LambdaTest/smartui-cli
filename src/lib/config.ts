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

    if (fs.existsSync(filepath)) {
        // The other half of TE-23033. `config:create-storybook` writes to this same default
        // path, and the schema lets one file carry both a `web` and a `storybook` block, so
        // running the two generators in either order has to work. When the file exists but
        // holds only a storybook block, add the web half rather than refusing.
        let existingConfig: Record<string, any> | undefined;
        try {
            existingConfig = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        } catch (error: any) {
            console.log(`Error: Cannot read existing config ${filepath}: ${error.message}`);
            return
        }

        if (existingConfig && existingConfig.storybook && !existingConfig.web) {
            // Copy every default key the file does not already have, not just `web`, so the
            // result matches what running the generators the other way round produces. The
            // top-level defaults (waitForTimeout, smartIgnore and friends) are part of a web
            // config, and leaving them out would give two different files for the same pair
            // of commands.
            for (const [key, value] of Object.entries(constants.DEFAULT_CONFIG)) {
                if (!(key in existingConfig)) existingConfig[key] = value;
            }
            fs.writeFileSync(filepath, JSON.stringify(existingConfig, null, 2) + '\n');
            console.log(`Added SmartUI Config to existing config: ${filepath}`);
            return
        }

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

export function createStorybookConfig(filepath: string) {
    // default filepath
    filepath = filepath || '.smartui.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        console.log('Error: Config file must have .json extension');
        return
    }

    // `config:create` writes to the same default path, and the config schema lets one file
    // carry both a `web` and a `storybook` block. So when the file is already there without
    // a storybook block, add the block rather than refusing to write.
    if (fs.existsSync(filepath)) {
        let existingConfig: Record<string, any>;
        try {
            existingConfig = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        } catch (error: any) {
            console.log(`Error: Cannot read existing config ${filepath}: ${error.message}`);
            return
        }

        if (existingConfig.storybook) {
            console.log(`Error: SmartUI Storybook config already exists: ${filepath}`);
            console.log(`To create a new file, please specify the file name like: 'smartui config:create-storybook .smartui-storybook.json'`);
            return
        }

        existingConfig.storybook = constants.DEFAULT_STORYBOOK_CONFIG.storybook;
        fs.writeFileSync(filepath, JSON.stringify(existingConfig, null, 2) + '\n');
        console.log(`Added SmartUI Storybook config to existing config: ${filepath}`);
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(constants.DEFAULT_STORYBOOK_CONFIG, null, 2) + '\n');
    console.log(`Created SmartUI Storybook Config: ${filepath}`);
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
        if(c.screenshot_viewports && c.screenshot_viewports.length > 0 && c.figma_ids && c.figma_ids.length != c.screenshot_viewports.length) {
            throw new Error("Mismatch in Figma Ids and Screenshot Viewports in figma config");
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

    let mobileConfig = ctx.config?.mobile || {}
    // Iterate over mobileConfig array and get viewport for each device
    if (Array.isArray(mobileConfig)) {
        for (const config of mobileConfig) {
            const deviceName = config.name;
            if (constants.SUPPORTED_MOBILE_DEVICES[deviceName]) {
                const deviceData = constants.SUPPORTED_MOBILE_DEVICES[deviceName];
                config.width = deviceData.viewport.width;
                config.height = deviceData.viewport.height;
            }
        }
    }
}

function isValidArray(input) {
    return Array.isArray(input) && input.length > 0;
}


export function createAppFigmaConfig(filepath: string) {
    // default filepath
    filepath = filepath || '.smartui.json';
    let filetype = path.extname(filepath);
    if (filetype != '.json') {
        console.log('Error: figma app config file must have .json extension');
        return
    }

    // verify the file does not already exist
    if (fs.existsSync(filepath)) {
        console.log(`Error: figma app config already exists: ${filepath}`);
        console.log(`To create a new figma app config, please specify the file name like: 'smartui config:create-figma-app <fileName>.json'`);
        return
    }

    // write stringified default config options to the filepath
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(constants.APP_FIGMA_CONFIG, null, 2) + '\n');
    console.log(`Created figma app config: ${filepath}`);
};