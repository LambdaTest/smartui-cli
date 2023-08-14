import Table from 'cli-table3';
import { constants } from './constants.js';

var INTERVAL = 2000
const MAX_INTERVAL = 512000

export async function fetchBuildStatus(client, build, log, retries = 0) {
    let response = await client.getBuildStatus(build.buildId)
    log.debug(response.data)
    if (response && response.data) {
        if (response.data.buildStatus === 'completed') {
            log.info('Build successful\n');
            log.info('Build details:\n Build URL: '+ response.data.buildURL +
                '\n Build Name: '+ response.data.buildName +
                '\n Total Screenshots: '+ response.data.totalScreenshots +
                '\n Approved: '+ response.data.buildResults.approved+
                '\n Changes found: '+ response.data.buildResults.changesFound+
                '\n Rejected:'+ response.data.buildResults.rejected+ '\n'
            );
            
            if (response.data.screenshots && response.data.screenshots.length > 0) {
                import('chalk').then((chalk) => {
                    const table = new Table({
                        head: [
                            {content: chalk.default.white('Story'), hAlign: 'center'},
                            {content: chalk.default.white('Mis-match %'), hAlign: 'center'},
                        ]
                    });
                    response.data.screenshots.forEach(screenshot => {
                        let mismatch = screenshot.mismatchPercentage
                        table.push([
                            chalk.default.yellow(screenshot.storyName),
                            mismatch > 0 ? chalk.default.red(mismatch) : chalk.default.green(mismatch)
                        ])
                    });
                    console.log(table.toString());

                    if (response.data.buildResults.changesFound != 0 || response.data.buildResults.rejected != 0) {
                        process.exitCode = constants.BUILD_NOT_APPROVED_EXIT;
                    }
                })
            } else {
                if (response.data.baseline) {
                    log.info('No comparisons run. This is a baseline build.');
                } else {
                    log.info('No comparisons run. No screenshot in the current build has the corresponding screenshot in baseline build.');
                }
            }
            return;
        } else {
            if (response.data.screenshots && response.data.screenshots.length > 0) {
                log.info('Screenshots compared: ' + response.data.screenshots.length)
            }
        }
    }
    try {
        // Double the INTERVAL, up to the maximum INTERVAL of 512 secs (so ~15 mins in total)
        INTERVAL = Math.min(INTERVAL * 2, MAX_INTERVAL);
        if (INTERVAL == MAX_INTERVAL) {
            log.info('Please check the build status on LambdaTest SmartUI.');
            return;
        }

        setTimeout(function () {
            fetchBuildStatus(client, build, log)
        }, INTERVAL);

    } catch (error){

    }
    return 
}
