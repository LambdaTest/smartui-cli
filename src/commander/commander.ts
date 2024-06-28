import { Command } from 'commander'
import exec from './exec.js'
import { configWeb, configStatic, configFigma} from './config.js'
import capture from './capture.js'
import upload from './upload.js'
import { version } from '../../package.json'
import uploadFigma from './uploadFigma.js'

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
    .addCommand(upload)
    .addCommand(configFigma)
    .addCommand(uploadFigma)
    

export default program;
