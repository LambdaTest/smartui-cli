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
        let { data: { latestVersion, deprecated, additionalDescription } } = await client.checkUpdate(log);
        log.info(`\nLambdaTest SmartUI CLI v${pkgJSON.version}`);
        log.info(chalk.yellow(`${additionalDescription}`));
        if (deprecated){ 
            log.warn(`This version is deprecated. A new version ${latestVersion} is available!`);
        }
        else if (pkgJSON.version !== latestVersion){ 
            log.info(chalk.green(`A new version ${latestVersion} is available!`));
        }
        else log.info(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
    } catch (error) {
        log.debug(error);
        log.info(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
    }
    
    commander.parse();
})();
