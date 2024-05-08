import { Command } from 'commander'
import { createConfig, createWebStaticConfig, createFigmaConfig } from '../lib/config.js'

export const configWeb = new Command();
export const configStatic = new Command();
export const configFigma = new Command();

configWeb
    .name('config:create')
    .description('Create SmartUI config file')
    .argument('[filepath]', 'Optional config filepath')
    .action(async function(filepath, options) {
        createConfig(filepath);
    })

configStatic
    .name('config:create-web-static')
    .description('Create Web Static config file')
    .argument('[filepath]', 'Optional config filepath')
    .action(async function(filepath, options) {
        createWebStaticConfig(filepath);
    })

configFigma
.name('config:create-figma')
.description('Create figma designs config file')
.argument('[filepath]', 'Optional config filepath')
.action(async function(filepath, options) {
    createFigmaConfig(filepath);
})


