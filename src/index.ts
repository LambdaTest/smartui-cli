#!/usr/bin/env node

import commander from './commander/commander.js'
import getEnv from './lib/env.js'
import httpClient from './lib/httpClient.js'
import logger from './lib/logger.js'
import chalk from 'chalk'
import pkgJSON from './../package.json'
import axios from 'axios'

let isCleaningUp = false;

// Override commander's parse method to prevent new executions during cleanup
// const originalParse = commander.parse;
// commander.parse = function(...args) {
//     if (isCleaningUp) {
//         return;
//     }
//     return originalParse.apply(this, args);
// };

// Override the exec:start command's action
const execCommand = commander.commands.find(cmd => cmd.name() === 'exec:start');
if (execCommand) {
    const originalAction = execCommand.action;
    execCommand.action(async function(...args) {
        if (isCleaningUp) {
            return;
        }
        return originalAction.apply(this, args);
    });
}

async function cleanup() {
    if (isCleaningUp) {
        return;
    }
    isCleaningUp = true;

    try {
        process.stdout.write('\n');
        logger.info('Received termination signal. Cleaning up...');
        
        const serverAddress = process.env.SMARTUI_SERVER_ADDRESS || 'http://localhost:49152';
        
        const stopServer = async () => {
            try {
                const response = await axios.post(`${serverAddress}/stop`, {}, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                
                if (response.status === 200) {
                    logger.info('Server stopped successfully');
                    return true;
                }
                return false;
            } catch (error) {
                logger.debug('Error stopping server:', error.message);
                return false;
            }
        };

        // Try to stop the server multiple times if needed
        let attempts = 3;
        while (attempts > 0) {
            if (await stopServer()) {
                break;
            }
            attempts--;
            if (attempts > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Wait for any pending operations to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        logger.info('Cleanup completed');
        
        // Force exit after ensuring logs are written
        process.nextTick(() => {
            process.exit(0);
        });
    } catch (error) {
        logger.error('Error during cleanup:', error);
        process.nextTick(() => {
            process.exit(1);
        });
    }
}

// Custom handler for SIGINT to prevent default behavior
process.on('SIGINT', () => {
    if (!isCleaningUp) {
        cleanup();
    }
});

process.on('SIGTERM', () => {
    if (!isCleaningUp) {
        cleanup();
    }
});

// Prevent the process from exiting prematurely
// process.stdin.resume();

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
        else {
            log.info("test log")
            log.info(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
        }
    } catch (error) {
        log.debug(error);
        log.info("test log")
        log.info(chalk.gray('https://www.npmjs.com/package/@lambdatest/smartui-cli\n'));
    }
    
    // if (!isCleaningUp) {
        commander.parse();
    // }
})();