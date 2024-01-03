import fs from 'fs';
import FormData from 'form-data';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Env, Snapshot, Git, Build, Context } from '../types.js';
import { delDir } from './utils.js';
import type { Logger } from 'winston'

export default class httpClient {
    axiosInstance: AxiosInstance;

    constructor({ SMARTUI_CLIENT_API_URL, PROJECT_TOKEN }: Env) {
        this.axiosInstance = axios.create({
            baseURL: SMARTUI_CLIENT_API_URL,
            headers: { 'projectToken': PROJECT_TOKEN },
        })
    }

    async request(config: AxiosRequestConfig, log: Logger): Promise<Record<string, any>> {
        log.debug(`http request: ${JSON.stringify(config)}`);

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
                    throw new Error(JSON.stringify(error.response.data));
                }
                if (error.request) {
                    throw new Error(error.toJSON().message);
                }
                throw new Error(error.message);
            })
    }

    auth(log: Logger) {
        return this.request({
            url: '/token/verify',
            method: 'GET'
        }, log)
    }

    createBuild({ branch, commitId, commitAuthor, commitMessage, githubURL}: Git, config: any, log: Logger) {
        return this.request({
            url: '/build',
            method: 'POST',
            data: {
                git: {
                    branch,
                    commitId,
                    commitAuthor,
                    commitMessage,
                    githubURL
                },
                config: {
                    browsers: config.browsers,
                    resolutions: config.viewports,
                    waitForPageRender: config.waitForPageRender,
                    waitForTimeout: config.waitForTimeout
                }
            }
        }, log)
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

    uploadSnapshot(buildId: string, snapshot: Snapshot, testType: string, log: Logger) {
        return this.request({
            url: `/builds/${buildId}/snapshot`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: { 
                snapshot,
                test: {
                    type: testType,
                    source: 'cli'
                }
            }
        }, log)
    }

    uploadScreenshot(
        { id: buildId, name: buildName, baseline }: Build, 
        ssPath: string, ssName: string, browserName :string, viewport: string,
        completed: boolean,
    ) {
        const file = fs.readFileSync(ssPath);
        const form = new FormData();
        form.append('screenshots', file, { filename: `${ssName}.png`, contentType: 'image/png'});
        form.append('browser', browserName);
        form.append('resolution', viewport);
        form.append('buildId', buildId);
        form.append('buildName', buildName);
        form.append('screenshotName', ssName);
        form.append('baseline', baseline.toString());
        form.append('completed', completed.toString());

        return this.axiosInstance.request({
            url: `/screenshot`,
            method: 'POST',
            headers: form.getHeaders(),
            data: form,
        })
        .then(() => {
            if (completed) delDir('screenshots')
        })
        .catch(error => {
            if (error.response) {
                throw new Error(JSON.stringify(error.response.data));
            }
            if (error.request) {
                throw new Error(error.toJSON().message);
            }
            throw new Error(error.message);
        })
    }
}
