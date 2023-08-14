import { Command, Option } from 'commander';
import { capture } from './capture.js';
import { logger } from '@lambdatest/smartui-logger';
import { validateScreenshotConfig } from './validate.js';
import packageJson from '../package.json' assert { type: 'json' };
import { createWebConfig, createWebStaticConfig } from './config.js';

const program = new Command();

program
  .name('smartui')
  .description('CLI to help you to take screenshot SmartUI  on LambdaTest platform')
  .addOption(new Option('--env <prod|stage>', 'Runtime environment option').choices(['prod', 'stage']));

program
  .command('capture <file>')
  .description('capture')
  .option('-c --config <file>', 'Config file path')
  .action(async function (file, options) {
    const log = await logger();
    options.env = program.opts().env || 'prod';
    log.info('SmartUI Capture CLI v' + packageJson.version);
    options.config = validateScreenshotConfig(file, options, log);
    log.info('config validation done');
    log.debug(options);
    capture(file, options, log);
  });

program.command('config:create-web')
  .description('Create SmartUI Web config file')
  .argument('[filepath]', 'Optional config filepath')
  .action(async function (filepath, options) {
    const log = await logger();
    log.info('SmartUI Config CLI v' + packageJson.version);
    log.info('\n');
    createWebConfig(filepath, log);
  });

program.command('config:web-static')
  .description('Create Web Static config file')
  .argument('[filepath]', 'Optional config filepath')
  .action(async function (filepath, options) {
    const log = await logger();
    log.info('SmartUI Config CLI v' + packageJson.version);
    log.info('\n');
    createWebStaticConfig(filepath, log);
  });

program.parse();