const fs = require('fs');
const { httpClient } = require('./httpClient.cjs');
const archiver = require('archiver');
var { constants } = require('./constants.cjs');
const { skipStory, normalizeStoryEntries } = require('./story.cjs');
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
	// Prefer index.json, matching URL-mode discovery in storybook.cjs (TE-24909).
	// Storybook >= 8 writes index.json; a stories.json sitting next to it is a leftover
	// from an older build of the same directory, and reading that instead would give DIR
	// mode a different story set from URL mode against the same Storybook.
	let indexFile;
	if (fs.existsSync((`${dirPath}/index.json`))){
		indexFile = `${dirPath}/index.json`;
	} else if(fs.existsSync((`${dirPath}/stories.json`))){
		indexFile = `${dirPath}/stories.json`;
	}

	if (indexFile) {
		let index;
		try {
			index = JSON.parse(fs.readFileSync(indexFile));
		} catch (error) {
			console.log(`[smartui] Error: Could not parse ${indexFile}: ${error.message}`);
			process.exit(constants.ERROR_CATCHALL);
		}
		stories = normalizeStoryEntries(index && (index.entries || index.stories));
		if (!stories) {
			console.log(`[smartui] Error: ${indexFile} does not contain a story index`);
			process.exit(constants.ERROR_CATCHALL);
		}
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
