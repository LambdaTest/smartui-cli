import { Command } from 'commander'
import { createWebConfig, createWebStaticConfig } from '../lib/config.js'

export const configWeb = new Command();
export const configStatic = new Command();

configWeb
    .name('config:create-web')
    .description('Create SmartUI Web config file')
    .argument('[filepath]', 'Optional config filepath')
    .action(async function(filepath, options) {
        createWebConfig(filepath);
    })

configStatic
    .name('config:web-static')
    .description('Create Web Static config file')
    .argument('[filepath]', 'Optional config filepath')
    .action(async function(filepath, options) {
        createWebStaticConfig(filepath);
    })
