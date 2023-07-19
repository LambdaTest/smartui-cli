import { Command,Option } from 'commander';
// import { version } from '../package.json';
import { capture } from './capture.js';
import { logger } from '@smartui/logger';
import { validateScreenshotConfig } from './validate.js';
import packageJson from '../package.json' assert { type: 'json' };

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

program.parse();