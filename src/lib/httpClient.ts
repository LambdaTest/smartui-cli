import fs from 'fs';
import FormData from 'form-data';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Env, ProcessedSnapshot, Git, Build, Context } from '../types.js';
import constants from './constants.js';
import type { Logger } from 'winston'
import pkgJSON from './../../package.json'

export default class httpClient {
    axiosInstance: AxiosInstance;
    projectToken: string;
    projectName: string;
    username: string;
    accessKey: string;

    constructor({ SMARTUI_CLIENT_API_URL, PROJECT_TOKEN, PROJECT_NAME, LT_USERNAME, LT_ACCESS_KEY }: Env) {
        this.projectToken = PROJECT_TOKEN || '';
        this.projectName = PROJECT_NAME || '';
        this.username = LT_USERNAME || '';
        this.accessKey = LT_ACCESS_KEY || '';

        this.axiosInstance = axios.create({
            baseURL: SMARTUI_CLIENT_API_URL,
        });
        this.axiosInstance.interceptors.request.use((config) => {
            config.headers['projectToken'] = this.projectToken;
            config.headers['projectName'] = this.projectName;
            config.headers['username'] = this.username;
            config.headers['accessKey'] = this.accessKey;
            return config;
        });
    }

    async request(config: AxiosRequestConfig, log: Logger): Promise<Record<string, any>> {
        log.debug(`http request: ${config.method} ${config.url}`);

        return this.axiosInstance.request(config)
            .then(resp => {
                log.debug(`http response: ${JSON.stringify({
                    status: resp.status,
                    headers: resp.headers,
                    body: resp.data
                })}`)
                return resp.data;
            })
            .catch(error => {
                if (error.response) {
                    log.debug(`http response: ${JSON.stringify({
                        status: error.response.status,
                        headers: error.response.headers,
                        body: error.response.data
                    })}`);
                    throw new Error(error.response.data.error?.message || error.response.data.message);
                }
                if (error.request) {
                    log.debug(`http request failed: ${error.toJSON()}`);
                    throw new Error(error.toJSON().message);
                }
                log.debug(`http request failed: ${error.message}`);
                throw new Error(error.message);
            })
    }

    async auth(log: Logger, env: Env): Promise<number> {
        let result = 1;
        if (this.projectToken) {
            result = 0;
        }
        const response = await this.request({
            url: '/token/verify',
            method: 'GET',
        }, log);
        if (response && response.projectToken) {
            this.projectToken = response.projectToken;
            env.PROJECT_TOKEN = response.projectToken;
            if (response.message && response.message.includes('Project created successfully')) {
                result = 2;
            }
            return result;
        } else {
            throw new Error('Authentication failed, project token not received');
        }
    }
    
    createBuild(git: Git, config: any, log: Logger) {
        return this.request({
            url: '/build',
            method: 'POST',
            data: {
                git,
                config
            }
        }, log)
    }

    getScreenshotData(buildId: string, baseline: boolean, log: Logger) {
        return this.request({
            url: '/screenshot',
            method: 'GET',
            params: { buildId, baseline }
        }, log);
    }    

    finalizeBuild(buildId: string, totalSnapshots: number, log: Logger) {
        let params: Record<string, string | number> = {buildId};
        if (totalSnapshots > -1) params.totalSnapshots = totalSnapshots;

        return this.request({
            url: '/build',
            method: 'DELETE',
            params: params
        }, log)
    }

    uploadSnapshot(ctx: Context, snapshot: ProcessedSnapshot) {
        return this.request({
            url: `/builds/${ctx.build.id}/snapshot`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: { 
                snapshot,
                test: {
                    type: ctx.testType,
                    source: 'cli'
                }
            }
        }, ctx.log)
    }

    uploadScreenshot(
        { id: buildId, name: buildName, baseline }: Build, 
        ssPath: string, ssName: string, browserName :string, viewport: string, log: Logger
    ) {
        browserName = browserName === constants.SAFARI ? constants.WEBKIT : browserName;
        const file = fs.readFileSync(ssPath);
        const form = new FormData();
        form.append('screenshot', file, { filename: `${ssName}.png`, contentType: 'image/png'});
        form.append('browser', browserName);
        form.append('viewport', viewport);
        form.append('buildId', buildId);
        form.append('buildName', buildName);
        form.append('screenshotName', ssName);
        form.append('baseline', baseline.toString());

        return this.axiosInstance.request({
            url: `/screenshot`,
            method: 'POST',
            headers: form.getHeaders(),
            data: form,
        })
        .then(() => {
            log.debug(`${ssName} for ${browserName} ${viewport} uploaded successfully`);
        })
        .catch(error => {
            log.error(`Unable to upload screenshot ${JSON.stringify(error)}`)
            if (error && error.response && error.response.data && error.response.data.error) {
                throw new Error(error.response.data.error.message);
            }
            if (error) {
                throw new Error(JSON.stringify(error));
            }
        })
    }

    checkUpdate(log: Logger) {
        return this.request({
            url: `/packageinfo`,
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            params: {
                packageName: pkgJSON.name,
                packageVersion: pkgJSON.version
            }
        }, log)
    }

    getFigmaFilesAndImages(figmaFileToken: string, figmaToken: String | undefined, queryParams: string, authToken: string, depth: number, markBaseline: boolean, buildName: string, log: Logger) {
    const requestBody = {
        figma_file_token: figmaFileToken,
        figma_token: figmaToken,
        query_params: queryParams,
        auth: authToken,
        depth: depth,
        mark_base_line: markBaseline,
        build_name: buildName
    };

        return this.request({
            url: "/uploadfigma",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            data: JSON.stringify(requestBody)
        }, log);
    }

    getS3PreSignedURL(ctx: Context) {
        return this.request({
            url: `/loguploadurl`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: {
                buildId: ctx.build.id
            }
        }, ctx.log)
    }

    uploadLogs(ctx: Context, uploadURL: string) {
        const fileStream = fs.createReadStream(constants.LOG_FILE_PATH);
        const { size } = fs.statSync(constants.LOG_FILE_PATH);

        return this.request({
            url: uploadURL,
            method: 'PUT',
            headers: {
                'Content-Type': 'text/plain',
                'Content-Length': size,
            },
            data: fileStream,
            maxBodyLength: Infinity, // prevent axios from limiting the body size
            maxContentLength: Infinity, // prevent axios from limiting the content size
        }, ctx.log)
    }
}
