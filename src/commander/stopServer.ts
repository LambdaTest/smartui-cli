import { Command } from 'commander';
import axios from 'axios'; // Import axios for HTTP requests
import chalk from 'chalk'
import { Context } from '../types.js'
import ctxInit from '../lib/ctx.js'

const command = new Command();

function getSmartUIServerAddress() {
    const serverAddress = process.env.SMARTUI_SERVER_ADDRESS || 'http://localhost:49152';
    return serverAddress;
}

command
    .name('exec:stop')
    .description('Stop the SmartUI server')
    .action(async function(this: Command) {
        try {
            const serverAddress = getSmartUIServerAddress();
            let ctx: Context = ctxInit(command.optsWithGlobals());
            console.log(chalk.yellow(`Stopping server at ${serverAddress} from terminal...`));
            ctx.log_stop.debug(`Stopping server at ${serverAddress} from terminal...`);

            // Send POST request to the /stop endpoint with the correct headers
            const response = await axios.post(`${serverAddress}/stop`, { timeout: 15000 }, {
                headers: {
                    'Content-Type': 'application/json' // Ensure the correct Content-Type header
                }
            });

            // Log the response from the server
            if (response.status === 200) {
                console.log(chalk.green('Server stopped successfully'));
                console.log(chalk.green(`Response: ${JSON.stringify(response.data)}`)); // Log response data if needed
                ctx.log_stop.info('Server stopped successfully');
                ctx.log_stop.debug(`Response: ${JSON.stringify(response.data)}`);
            } else {
                console.log(chalk.red('Failed to stop server'));
                ctx.log.error('Failed to stop server');
            }
        } catch (error: any) {
            // Handle any errors during the HTTP request
            if (error.code === 'ECONNABORTED') {
                console.error(chalk.red('Error: SmartUI server did not respond in 15 seconds'));
            } else {
                console.error(chalk.red('Error while stopping server'));
            }
        }
    });

export default command;
