import { Command } from 'commander';
import axios from 'axios';
import chalk from 'chalk'

function getSmartUIServerAddress() {
    const serverAddress = process.env.SMARTUI_SERVER_ADDRESS || 'http://localhost:49152';
    return serverAddress;
}

const command = new Command();

command
    .name('exec:ping')
    .description('Ping the SmartUI server to check if it is running')
    .action(async function(this: Command) {
        try {
            console.log(chalk.yellow("Pinging server..."));
            const serverAddress = getSmartUIServerAddress();
            console.log(chalk.yellow(`Pinging server at ${serverAddress} from terminal...`));

            // Send GET request to the /ping endpoint
            const response = await axios.get(`${serverAddress}/ping`);

            // Log the response from the server
            if (response.status === 200) {
                console.log(chalk.green('SmartUI Server is running'));
                console.log(chalk.green(`Response: ${JSON.stringify(response.data)}`)); // Log response data if needed
            } else {
                console.log(chalk.red('Failed to reach the server'));
            }
        } catch (error: any) {
            // Handle any errors during the HTTP request
            console.error(chalk.red('SmartUI server is not running'));
        }
    });

export default command;
