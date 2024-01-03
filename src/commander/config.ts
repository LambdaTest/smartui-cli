import { Command } from 'commander'
import { createConfig, createWebStaticConfig } from '../lib/config.js'

export const configWeb = new Command();
export const configStatic = new Command();

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
