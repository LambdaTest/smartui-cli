import { Command } from 'commander';
import { Context } from '../types.js';
import { color, Listr, ListrDefaultRendererLogLevels } from 'listr2';
import startServer from '../tasks/startServer.js';
import auth from '../tasks/auth.js';
import ctxInit from '../lib/ctx.js';
import getGitInfo from '../tasks/getGitInfo.js';
import createBuild from '../tasks/createBuild.js';
import snapshotQueue from '../lib/snapshotQueue.js';
import axios from 'axios';

// const waitForSIGINT = {
//     title: 'Waiting for SIGINT (Press Ctrl+C to exit)',
//     task: async () => {
//       console.log('Press Ctrl+C to stop...');
      
//       return new Promise<void>((resolve) => {
//         const handler = async () => {
//           console.log('\nSIGINT received! Cleaning up...');
  
//           // Perform cleanup tasks here with access to the ctx object
//           // Example: if you want to log or do something with ctx:
//           // ctx.log.info('Performing cleanup after SIGINT...');
  
//           // Example: Close server gracefully (if needed)
//         //   if (ctx.server) {
//         //     await ctx.server.close();  // Assuming the server has a `close` method
//         //     console.log('Server closed gracefully');
//         //   }
  
//           // Ensure only one listener
//           process.off('SIGINT', handler);
//           resolve();
//         };
  
//         process.once('SIGINT', handler); // Ensure only one listener
//       });
//     }
//   };
  
//   process.removeAllListeners('SIGINT')
  // Attach SIGINT handler before running Listr
//   process.on('SIGINT', async () => {
//     setImmediate( async () => {
//         console.log('\nSIGINT received globally. Exiting...');
//     const response = await axios.post(`http://localhost:49152/stop`, {}, {
//         headers: {
//             'Content-Type': 'application/json' // Ensure the correct Content-Type header
//         }
//     });
//     console.log("reponse is below")
//     console.log(response)
//     process.exit(0);
//     })
//   });

const command = new Command();

command
    .name('exec:start')
    .description('Start SmartUI server')
    .option('-P, --port <number>', 'Port number for the server')
    .action(async function(this: Command) {
        const options = this.opts();
        let ctx: Context = ctxInit(command.optsWithGlobals());
        ctx.snapshotQueue = new snapshotQueue(ctx);
        ctx.totalSnapshots = 0

        let tasks = new Listr<Context>(
            [
                auth(ctx),
                startServer(ctx),
                getGitInfo(ctx),
                createBuild(ctx),

            ],
            {
                rendererOptions: {
                    icon: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: `→`
                    },
                    color: {
                        [ListrDefaultRendererLogLevels.OUTPUT]: color.gray
                    }
                }
            }
        );

        try {
            // const sigintPromise = new Promise((resolve) => {
            //     process.once('SIGINT', () => {
            //         resolve("SIGINT received, exiting...")
            //     });
            // });
            // await Promise.any([tasks.run(ctx), sigintPromise]);
            await tasks.run(ctx);
            
    
        } catch (error) {
            console.error('Error during server execution:', error);
        }
    });

    //   process.removeAllListeners('SIGINT')
  // Attach SIGINT handler before running Listr

// process.on('beforeExit', async () => {
//                 console.log('\nSIGINT received globally. Exiting...');
//                 const response = await axios.post(`http://localhost:49152/stop`, {}, {
//                 headers: {
//                     'Content-Type': 'application/json' // Ensure the correct Content-Type header
//                 }
//             });
//             console.log("reponse is below")
//             console.log(response)
//             // process.exit(0);
            
//           });

export default command;
