import { Command } from 'commander'
import exec from './exec.js'
import { configWeb, configStatic } from './config.js'
import capture from './capture.js'
import { version } from '../../package.json'

const program = new Command();

program
    .name('smartui')
    .description('CLI to help you run your SmartUI tests on LambdaTest platform')
    .version(`v${version}`)
    .option('-c --config <filepath>', 'Config file path')
    .addCommand(exec)
    .addCommand(capture)
    .addCommand(configWeb)
    .addCommand(configStatic)


export default program;
