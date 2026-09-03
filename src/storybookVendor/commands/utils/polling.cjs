const { httpClient } = require('./httpClient.cjs');
const Table = require('cli-table3');
var { constants } = require('./constants.cjs');

var INTERVAL = 2000
const MAX_EXPONENTIAL_INTERVAL = 512000 // 512 seconds (8.5 minutes)
const FIXED_INTERVAL = 60000 // 1 minute in milliseconds
const MAX_INTERVAL = 1800000; // 30 minutes in milliseconds
var CURRENT_TIME = 0
var FLAG = 0

async function shortPolling(buildId, retries = 0, options) {
    await httpClient.get(new URL('?buildId=' + buildId, constants[options.env].BUILD_STATUS_URL).href, {
        headers: {
            projectToken: process.env.PROJECT_TOKEN
        }})
        .then(function (response) {
            if (response.data) {
                if (response.data.buildStatus === 'completed') {
                    console.log('[smartui] Build successful\n');
                    console.log('[smartui] Build details:\n',
                        'Build URL: ', response.data.buildURL, '\n',
                        'Build ID: ', buildId, '\n',
                        'Build Name: ', response.data.buildName, '\n',
                        'Total Screenshots: ', response.data.totalScreenshots, '\n',
                        'Approved: ', response.data.buildResults.approved, '\n',
                        'Changes found: ', response.data.buildResults.changesFound, '\n',
                        'Rejected:' , response.data.buildResults.rejected, '\n'
                    );
                    
                    if (response.data.screenshots && response.data.screenshots.length > 0) {
                        import('chalk').then((chalk) => {
                            const table = new Table({
                                head: [
                                    {content: chalk.default.white('Sr. Number'), hAlign: 'center'},
                                    {content: chalk.default.white('Story'), hAlign: 'center'},
                                    {content: chalk.default.white('Mis-match %'), hAlign: 'center'},
                                ]
                            });
                            response.data.screenshots.forEach((screenshot, index) => {
                                let mismatch = screenshot.mismatchPercentage;
                                table.push([
                                    chalk.default.yellow(index + 1),
                                    chalk.default.yellow(screenshot.storyName),
                                    mismatch > 0 ? chalk.default.red(mismatch) : chalk.default.green(mismatch)
                                ]);
                            });
                            console.log(table.toString());
                        })
                    } else {
                        if (response.data.baseline) {
                            console.log('No comparisons run. This is a baseline build.');
                        } else {
                            console.log('No comparisons run. No screenshot in the current build has the corresponding screenshot in baseline build.');
                        }
                    }
                    return;
                } else {
                    if (response.data.screenshots && response.data.screenshots.length > 0) {
                        // TODO: show Screenshots processed current/total
                        console.log('[smartui] Screenshots compared: ', response.data.screenshots.length)
                    }
                }
            }

            CURRENT_TIME = CURRENT_TIME + INTERVAL
            if (CURRENT_TIME >= MAX_INTERVAL) {
                console.log('[smartui] Please check the build status on LambdaTest SmartUI.');
                return;
            }

            // Adjust the interval
            if (Math.min(INTERVAL * 2, MAX_EXPONENTIAL_INTERVAL) < MAX_EXPONENTIAL_INTERVAL && FLAG == 0) {
                INTERVAL = Math.min(INTERVAL * 2, MAX_EXPONENTIAL_INTERVAL);
            } else {
                FLAG = 1
                INTERVAL = FIXED_INTERVAL; // Switch to fixed interval after reaching 256 seconds
            }

            setTimeout(function () {
                shortPolling(buildId, 0, options)
            }, INTERVAL);
        })
        .catch(function (error) {
            if (retries >= 3) {
                console.log('[smartui] Error: Failed getting build status.', error.message);
                console.log('[smartui] Please check the build status on LambdaTest SmartUI.');
                return;
            }

            setTimeout(function () {
                shortPolling(buildId, retries+1, options);
            }, 2000);
        });
};

module.exports = { shortPolling }