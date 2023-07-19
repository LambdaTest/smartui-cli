
import { environment, constants } from './constants.js';
import axios from 'axios';
import { getLastCommit } from './utils.js';
import { cleanFile,cleanupDir } from './cleanup.js';

export class SmartUIClient {

    constructor(env, log) {
        this.token = process.env.PROJECT_TOKEN;
        log.debug(env)
        this.apiUrl = environment[env].SMARTUI_CLIENT_API_URL;
        log.debug(this.apiUrl, this.token)
        this.log = log;
    }

    getToken() {
        let token = this.token;
        if (!token || token == '') {
            this.log.error('Missing Project token,  Please set PROJECT_TOKEN key or refer to https://smartui.lambdatest.com');
            process.exit(constants.ABNORMAL_EXIT);
        }
        return token;
    }

    getGitURL() {
        return process.env.GITHUB_URL || '';
    }

    // Returns common headers used for each request with additional headers.
    headers(headers) {
        return Object.assign({
            projectToken: this.getToken()
        }, headers);
    }

    // Performs a GET request for an API endpoint with appropriate headers.
    get(path) {
        return getRequest(`${this.apiUrl}/${path}`, {
            headers: this.headers(),
        }, this.log);
    }

    // Performs a POST request to a JSON API endpoint with appropriate headers.
    post(path, body = {}) {
        return postRequest(`${this.apiUrl}/${path}`, body, {
            headers: this.headers({ 'Content-Type': 'application/json' }),
        }, this.log);
    }

    // Retrieves build data by id. Requires a read access token.
    validateToken() {
        this.log.debug(`Validate Project Token started`);
        return this.get(constants.VALIDATE_PATH);
    }

    async createBuild() {
        this.log.debug(`Create SmartUI Build started`);
        let commit = await getLastCommit();
        let payload = {
            git: {
                branch: commit.branch,
                commitId: commit.shortHash,
                commitAuthor: commit.author.name,
                commitMessage: commit.subject,
                githubURL: this.getGitURL(),
            }
        }
        return this.post(constants.BUILD_PATH, payload);
    }

    upload(body,payload) {
        this.log.debug(`upload screenshot started`);
        return pushScreenshot(`${this.apiUrl}/${constants.SCREENSHOT_PATH}`, body, {
            headers: this.headers(),
        }, this.log, payload);
    }

    getBuildStatus(buildId){
        this.log.debug(`getBuildStatus started`);
        return getStatus(`${this.apiUrl}/${constants.BUILD_PATH}?buildId=${buildId}`, {
            headers: this.headers(),
        }, this.log);
    }
}

function getRequest(url, options, log) {
    log.debug(`${url} ${options}`)
    return axios.get(url, options)
        .then(function (response) {
            return response && response.data
        })
        .catch(function (error) {
            if (error.response) {
                log.error('Error: Invalid Project Token');
            } else if (error.request) {
                log.error('Project Token not validated. Error: ', error.message);
            } else {
                log.error('Project Token not validated. Error: ', error.message);
            }
            process.exit(constants.ABNORMAL_EXIT);
        });
}

function postRequest(url, body, options, log) {
    log.debug(`${url} ${body} ${options}`)
    return axios.post(url, body, options)
        .then(async function (response) {
            log.info('Build Created');
            let build = response.data && response.data.data
            log.debug(build)
            return response && response.data
        })
        .catch(function (error) {
            if (error && error.response && error.response.data) {
                log.debug(error.response.data);
                log.info('Build Creation Failed');
                return error.response.data;
            }
            if (error.response) {
                log.error('Build creation failed: response: ', error.response.data.error?.message);
            } else {
                log.error('Build creation failed: Error: ', error);
            }
            process.exitCode = constants.ABNORMAL_EXIT;
        })
}

function pushScreenshot(url, body, options, log, payload) {
    log.debug(url)
    log.debug(options)
    return axios.post(url, body, options).
        then(async function (response) {
            log.debug("uploaded success");
            log.debug(response.data)
            if (response.data) {
                log.debug("Screenshot uploaded")
                cleanFile(log, payload.spath)
            }

            if (payload && payload.completed) {
                cleanupDir(log, 'screenshots')
            }
        }).catch(function (error) {
            if (error.response) {
                log.error('Screenshot failed error response : ' + error.response.data.message);
            } else {
                log.error('Screenshot failed: Error: ' + error.message);
            }
        });
}

function getStatus(url, options, log) {
    log.debug(url)
    log.debug(options)
    return axios.get(url, options);
}

export default SmartUIClient;
