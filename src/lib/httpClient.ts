import fs from 'fs';
import FormData from 'form-data';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Env, ProcessedSnapshot, Git, Build } from '../types.js';
import constants from './constants.js';
import type { Logger } from 'winston'
import pkgJSON from './../../package.json'

export default class httpClient {
    axiosInstance: AxiosInstance;

    constructor({ SMARTUI_CLIENT_API_URL, PROJECT_TOKEN }: Env) {
        this.axiosInstance = axios.create({
            baseURL: SMARTUI_CLIENT_API_URL,
            headers: { 'projectToken': PROJECT_TOKEN },
        })
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

    auth(log: Logger) {
        return this.request({
            url: '/token/verify',
            method: 'GET'
        }, log)
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

    finalizeBuild(buildId: string, totalSnapshots: number, log: Logger) {
        let params: Record<string, string | number> = {buildId};
        if (totalSnapshots > -1) params.totalSnapshots = totalSnapshots;

        return this.request({
            url: '/build',
            method: 'DELETE',
            params: params
        }, log)
    }

    uploadSnapshot(buildId: string, snapshot: ProcessedSnapshot, testType: string, log: Logger) {
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
            if (error.response) {
                throw new Error(error.response.data.error.message);
            }
            if (error.request) {
                throw new Error(error.toJSON().message);
            }
            throw new Error(error.message);
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

    getFigmaFilesAndImages(requestBody: any, log: Logger) {
        return this.request({
            url: "https://stage-api.lambdatestinternal.com/visualui/1.0/uploadfigma",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            data: JSON.stringify(requestBody) // Sending requestBody in the request body
        }, log);
      }
}
