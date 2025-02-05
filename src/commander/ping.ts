import { Command } from 'commander';
import axios from 'axios'; // Import axios for HTTP requests

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
            console.log("Pinging server...");
            const serverAddress = getSmartUIServerAddress();
            console.log(`Pinging server at ${serverAddress} from terminal...`);

            // Send GET request to the /ping endpoint
            const response = await axios.get(`${serverAddress}/ping`);

            // Log the response from the server
            if (response.status === 200) {
                console.log('SmartUI Server is running');
                console.log(`Response: ${JSON.stringify(response.data)}`); // Log response data if needed
            } else {
                console.log('Failed to reach the server');
            }
        } catch (error: any) {
            // Handle any errors during the HTTP request
            console.error('SmartUI server is not running                                                        ', error.message);
        }
    });

export default command;
