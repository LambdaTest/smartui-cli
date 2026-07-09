const fs = require('fs');
const { httpClient } = require('./httpClient.cjs');
const archiver = require('archiver');
var { constants } = require('./constants.cjs');
const { skipStory } = require('./story.cjs');
const { shortPolling } = require('./polling.cjs');

var INTERVAL = 2000
const MAX_INTERVAL = 512000

function getSignedUrl(options) {
    return httpClient.get(new URL(constants[options.env].GET_SIGNED_URL_PATH, constants[options.env].BASE_URL).href, {
        headers: {
            projectToken: process.env.PROJECT_TOKEN
        }});
}

async function compress(dirPath, uploadId) {
	return new Promise(function (resolve, reject) {
		// create a file to stream archive data to.
		const output = fs.createWriteStream('storybook-static.zip', {autoClose: true, emitClose: false});
		const archive = archiver('zip', {
		zlib: { level: 9 } // Sets the compression level.
		});

		output.on('end', function() {
			console.log('Data has been drained');
		});

		output.on('finish', function() {
			resolve();
		});

		// Catch warnings (ie stat failures and other non-blocking errors)
		archive.on('warning', function(err) {
		if (err.code === 'ENOENT') {
			console.log('Warning: ', err)
		} else {
			reject(err)
		}
		});

		// Catch errors
		archive.on('error', function(err) {
			reject(err);
		});

		// pipe archive data to the file
		archive.pipe(output);
		// append files from a sub-directory and naming it `new-subdir` within the archive
		archive.directory(dirPath, uploadId);
		archive.finalize();
	});
}

function filterStories(dirPath, storybookConfig) {
	let storyIds = [];
	let stories = []
	if (fs.existsSync((`${dirPath}/stories.json`))){
		stories = JSON.parse(fs.readFileSync(`${dirPath}/stories.json`)).stories;
	} else if(fs.existsSync((`${dirPath}/index.json`))){
		stories = JSON.parse(fs.readFileSync(`${dirPath}/index.json`)).entries;
	}

	for (const [storyId, storyInfo] of Object.entries(stories)) {
		if (!skipStory(storyInfo, storybookConfig)) {
			storyIds.push(storyId);
		}
	}
	if (storyIds.length === 0) {
		console.log('[smartui] Error: No stories found');
		process.exit(constants.ERROR_CATCHALL);
	}
	console.log('[smartui] Stories found: ', storyIds.length);
	console.log('[smartui] Number of stories rendered may differ based on the config file.');

	return storyIds
}

module.exports = { getSignedUrl, compress, filterStories };
