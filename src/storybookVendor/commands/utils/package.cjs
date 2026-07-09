var { constants } = require('./constants.cjs');
const { httpClient } = require('./httpClient.cjs');

// Check for package updates
function checkUpdate(version, options) {
    return httpClient.get(new URL(constants[options.env].CHECK_UPDATE_PATH, constants[options.env].BASE_URL).href, {
        params: {
            packageName: 'smartui-storybook',
            packageVersion: version
        }})
        .then(function (response) {
            if (response.data.data.deprecated) {
                console.log('v' + version + ' is deprecated. Please update to v' + response.data.data.latestVersion);
            } else if (response.data.data.latestVersion != version) {
                console.log('A newer version v' + response.data.data.latestVersion + ' is available.');
            }
        })
        .catch(function (error) {
            if (error.response && error.response.data && error.response.data.error) {
                console.log('Cannot check for updates. Error: ' + error.response.data.error.message);
            } else if (error.code) {
                console.log('Cannot check for updates. Error: ' + error.code + (error.message ? ' - ' + error.message : ''));
            } else {
                console.log('Cannot check for updates. Error: ' + (error.message || JSON.stringify(error)));   
            }
        });
};

module.exports = { checkUpdate };