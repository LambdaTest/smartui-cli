#!/usr/bin/env node

import commander from './commander/commander.js'
import getEnv from './lib/env.js'
import httpClient from './lib/httpClient.js'
// import logger from './lib/logger.js'
import chalk from 'chalk'
import pkgJSON from './../package.json'
import constants from './lib/constants.js';
import fs from 'fs';

(async function() {
    let client = new httpClient(getEnv());
    // let log = logger;

    try {
        // Delete log file
        // fs.unlinkSync(constants.LOG_FILE_PATH);
        // let { data: { latestVersion, deprecated, additionalDescription } } = await client.checkUpdate(log);
        // console.log(`\nLambdaTest SmartUI CLI v${pkgJSON.version}`);
        // console.log(chalk.yellow(`${additionalDescription}`));
        // if (deprecated){ 
        //     console.warn(`This version is deprecated. A new version ${latestVersion} is available!`);
        // }
        // else if (pkgJSON.version !== latestVersion){ 
        //     console.log(chalk.green(`A new version ${latestVersion} is available!`));
        // }
        // else console.log(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
    } catch (error) {
        console.error(error);
        console.log(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
    }
    
    commander.parse();
})();
