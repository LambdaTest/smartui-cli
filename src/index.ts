#!/usr/bin/env node

import commander from './commander/commander.js'
import getEnv from './lib/env.js'
import httpClient from './lib/httpClient.js'
import logger from './lib/logger.js'
import chalk from 'chalk'
import pkgJSON from './../package.json'

(async function() {
    let client = new httpClient(getEnv());
    let log = logger;

    try {
        log.info(`\nLambdaTest SmartUI CLI v${pkgJSON.version}`);
        let { data: { latestVersion, deprecated } } = await client.checkUpdate(log);
        if (deprecated) log.warn(`This version is deprecated. A new version ${latestVersion} is available!\n`);
        else if (pkgJSON.version !== latestVersion) log.info(chalk.gray(`A new version ${latestVersion} is available!\n`));
        else log.info(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
    } catch (error) {
        log.debug(error);
        log.info(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
    }
    
    commander.parse();
})();
