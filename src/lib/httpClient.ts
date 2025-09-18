import fs from 'fs';
import FormData from 'form-data';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Env, Snapshot, ProcessedSnapshot, Git, Build, Context, DiscoveryErrors } from '../types.js';
import constants from './constants.js';
import type { Logger } from 'winston'
import pkgJSON from './../../package.json'
import https from 'https';

export default class httpClient {
    axiosInstance: AxiosInstance;
    projectToken: string;
    projectName: string;
    username: string;
    accessKey: string;

    private handleHttpError(error: any, log: Logger): never {
        if (error && error.response) {
            log.debug(`http response error: ${JSON.stringify({
                status: error.response.status,
                body: error.response.data
            })}`);
            throw new Error(error.response.data?.message || error.response.data || `HTTP ${error.response.status} error`);
        }
        log.debug(`http request failed: ${error.message}`);
        throw new Error(error.message);
    }

    constructor({ SMARTUI_CLIENT_API_URL, PROJECT_TOKEN, PROJECT_NAME, LT_USERNAME, LT_ACCESS_KEY, SMARTUI_API_PROXY, SMARTUI_API_SKIP_CERTIFICATES }: Env) {
        this.projectToken = PROJECT_TOKEN || '';
        this.projectName = PROJECT_NAME || '';
        this.username = LT_USERNAME || '';
        this.accessKey = LT_ACCESS_KEY || '';

        let proxyUrl = null;
        try {
            // Handle URL with or without protocol
            const urlStr = SMARTUI_API_PROXY?.startsWith('http') ?
                SMARTUI_API_PROXY : `http://${SMARTUI_API_PROXY}`;
            proxyUrl = SMARTUI_API_PROXY ? new URL(urlStr) : null;
        } catch (error) {
            console.error('Invalid proxy URL:', error);
        }
        const axiosConfig: any = {
            baseURL: SMARTUI_CLIENT_API_URL,
            proxy: proxyUrl ? {
                host: proxyUrl.hostname,
                port: proxyUrl.port ? Number(proxyUrl.port) : 80
            } : false
        };

        if (SMARTUI_API_SKIP_CERTIFICATES) {
            axiosConfig.httpsAgent = new https.Agent({
                rejectUnauthorized: false
            });
        }

        this.axiosInstance = axios.create(axiosConfig);

        this.axiosInstance.interceptors.request.use((config) => {
            if (!config.headers['projectToken'] && this.projectToken !== '') {
                config.headers['projectToken'] = this.projectToken;
            } else if ((!config.headers['projectName'] && this.projectName !== '')) {
                config.headers['projectName'] = this.projectName;
                if (!config.headers['username'] || config.headers['username'] === '') {
                    config.headers['username'] = this.username;
                }
                if (!config.headers['accessKey'] || config.headers['accessKey'] === '') {
                    config.headers['accessKey'] = this.accessKey;
                }
            }
            return config;
        });

        //  Add a request interceptor for retry logic
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            async (error) => {
                const { config } = error;
                if (config && config.url === '/screenshot' && config.method === 'post') {
                    // Set default retry count and delay if not already defined
                    if (!config.retryCount) {
                        config.retryCount = 0;
                        config.retry = 2;
                        config.retryDelay = 5000;
                    }

                    // Check if we should retry the request
                    if (config.retryCount < config.retry) {
                        config.retryCount += 1;
                        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
                        config.timeout = 30000;
                        return this.axiosInstance(config);
                    }

                    // If we've reached max retries, reject with the error
                    return Promise.reject(error);
                } else {
                    return Promise.reject(error);
                }
            }
        );
    }



    async request(config: AxiosRequestConfig, log: Logger): Promise<Record<string, any>> {
        log.debug(`http request: ${config.method} ${config.url}`);
        if (config && config.data && !config.data.skipLogging && !config.data.name && !config.data.snapshot) {
            log.debug(config.data);
        }
        if (config && config.data && !config.data.skipLogging && config.data.snapshotUuid) {
            log.debug(config.data);
        }
        return this.axiosInstance.request(config)
            .then(resp => {
                if (resp) {
                    log.debug(`http response: ${JSON.stringify({
                        status: resp.status,
                        headers: resp.headers,
                        body: resp.data
                    })}`)
                    if (resp.data !== ""){
                        return resp.data;
                    } else {
                        return resp;
                    }
                } else {
                    log.debug(`empty response: ${JSON.stringify(resp)}`)
                    return {};
                }
            })
            .catch(error => {
                if (error.response) {
                    log.debug(`http response: ${JSON.stringify({
                        status: error.response.status,
                        headers: error.response.headers,
                        body: error.response.data
                    })}`);
                    throw new Error(error.response.data.error?.message || error.response.data.message || error.response.data);
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
            headers:{
                userName : env.LT_USERNAME,
                accessKey: env.LT_ACCESS_KEY
            }
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

    async authExec(ctx: Context, log: Logger, env: Env): Promise<{ authResult: number, orgId: number, userId: number }> {
        let authResult = 1;
        let userName = ctx.env.LT_USERNAME;
        let passWord = ctx.env.LT_ACCESS_KEY;
        if (ctx.config.tunnel) {
            if (ctx.config.tunnel?.user && ctx.config.tunnel?.key) {
                userName = ctx.config.tunnel.user
                passWord = ctx.config.tunnel.key
            } else {
                userName = this.username
                passWord = this.accessKey
            }
        } 
        if (this.projectToken) {
            authResult = 0;
        }
        const response = await this.request({
            url: '/token/verify',
            method: 'GET',
            headers: {
                username: userName,
                accessKey: passWord
            }
        }, log);
        if (response && response.projectToken) {
            let orgId = 0;
            let userId = 0;
            this.projectToken = response.projectToken;
            env.PROJECT_TOKEN = response.projectToken;
            if (response.message && response.message.includes('Project created successfully')) {
                authResult = 2;
            }
            if (response.orgId) {
                orgId = response.orgId
            }
            if (response.userId) {
                userId = response.userId
            }
            return { authResult, orgId, userId };
        } else {
            if(response && response.message) {
                throw new Error(response.message);
            }
            throw new Error('Authentication failed, project token not received. Refer to the smartui.log file for more information');
        }
    }

    createBuild(git: Git, config: any, log: Logger, buildName: string, isStartExec: boolean, smartGit: boolean, markBaseline: boolean, baselineBuild: string, scheduled?: string,userName?: string,accessKey?: string) {
        return this.request({
            url: '/build',
            method: 'POST',
            headers:{
                userName,
                accessKey
            },
            data: {
                git,
                config,
                buildName,
                isStartExec,
                packageVersion: pkgJSON.version,
                smartGit,
                markBaseline,
                baselineBuild,
                scheduled
            }
        }, log)
    }

    getScreenshotData(buildId: string, baseline: boolean, log: Logger, projectToken: string) {
        return this.request({
            url: '/screenshot',
            method: 'GET',
            params: { buildId, baseline },
            headers: {projectToken: projectToken}
        }, log);
    }

    getTunnelDetails(ctx: Context, log: Logger) {
        const data: any = { 
            orgId: ctx.orgId,
            userId: ctx.userId,
            userName: ctx.config.tunnel?.user,
            password: ctx.config.tunnel?.key
        };
    
        if (ctx.config.tunnel?.tunnelName) {
            data.tunnelName = ctx.config.tunnel.tunnelName;
        }
    
        return this.request({
            url: '/tunnel',
            method: 'POST',
            data: data
        }, log);
    }

    ping(buildId: string, log: Logger) {
        return this.request({
            url: '/build/ping',
            method: 'POST',
            data: {
                buildId: buildId
            }
        }, log);
    }


    getSmartUICapabilities(sessionId: string, config: any, git: any, log: Logger, isStartExec: boolean) {
        return this.request({
            url: '/sessions/capabilities',
            method: 'GET',
            params: {
                sessionId: sessionId,
            },
            data: {
                git,
                config,
                isStartExec
            },
            headers: {
                projectToken: '',
                projectName: '',
                username: '',
                accessKey: ''
            },
        }, log);
    }
    
    finalizeBuild(buildId: string, totalSnapshots: number, log: Logger) {
        let params: Record<string, string | number> = { buildId };
        if (totalSnapshots > -1) params.totalSnapshots = totalSnapshots;

        return this.request({
            url: '/build',
            method: 'DELETE',
            params: params
        }, log)
    }

    finalizeBuildForCapsWithToken(buildId: string, totalSnapshots: number, projectToken: string, log: Logger) {
        let params: Record<string, string | number> = { buildId };
        if (totalSnapshots > -1) params.totalSnapshots = totalSnapshots;
        return this.request({
            url: '/build',
            method: 'DELETE',
            params: params,
            headers: {
                projectToken: projectToken, // Use projectToken dynamically
            },
        }, log);
    }
    

    uploadSnapshot(ctx: Context, snapshot: ProcessedSnapshot,  discoveryErrors: DiscoveryErrors) {
        // Use capsBuildId if provided, otherwise fallback to ctx.build.id
        return this.request({
            url: `/builds/${ctx.build.id}/snapshot`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: {
                snapshot,
                test: {
                    type: ctx.testType,
                    source: 'cli'
                },
                discoveryErrors: discoveryErrors,
            }
        }, ctx.log)
    }

    processSnapshot(ctx: Context, snapshot: ProcessedSnapshot, snapshotUuid: string,  discoveryErrors: DiscoveryErrors, variantCount: number, sync: boolean = false, approvalThreshold: number| undefined, rejectionThreshold: number| undefined) {
        const requestData: any = {
            name: snapshot.name,
            url: snapshot.url,
            snapshotUuid: snapshotUuid,
            variantCount: variantCount,
            test: {
                type: ctx.testType,
                source: 'cli'
            },
            discoveryErrors: discoveryErrors,
            doRemoteDiscovery: snapshot.options.doRemoteDiscovery,
            sync: sync
        };

        if (approvalThreshold !== undefined) {
            requestData.approvalThreshold = approvalThreshold;
        }
        if (rejectionThreshold !== undefined) {
            requestData.rejectionThreshold = rejectionThreshold;
        }

        return this.request({
            url: `/build/${ctx.build.id}/snapshot`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: requestData
        }, ctx.log)
    }

    processSnapshotCaps(ctx: Context, snapshot: ProcessedSnapshot, snapshotUuid: string, capsBuildId: string, capsProjectToken: string, discoveryErrors: DiscoveryErrors) {
        return this.request({
            url: `/build/${capsBuildId}/snapshot`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                projectToken: capsProjectToken !== '' ? capsProjectToken : this.projectToken
            },
            data: {
                name: snapshot.name,
                url: snapshot.url,
                snapshotUuid: snapshotUuid,
                test: {
                    type: ctx.testType,
                    source: 'cli'
                },
                doRemoteDiscovery: snapshot.options.doRemoteDiscovery,
                discoveryErrors: discoveryErrors,
            }
        }, ctx.log)
    }

    uploadSnapshotForCaps(ctx: Context, snapshot: ProcessedSnapshot, capsBuildId: string, capsProjectToken: string, discoveryErrors: DiscoveryErrors) {
        // Use capsBuildId if provided, otherwise fallback to ctx.build.id
        const buildId = capsBuildId !== '' ? capsBuildId : ctx.build.id;
    
        return this.request({
            url: `/builds/${buildId}/snapshot`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                projectToken: capsProjectToken !== '' ? capsProjectToken : this.projectToken // Use capsProjectToken dynamically
            },
            data: { 
                snapshot,
                test: {
                    type: ctx.testType,
                    source: 'cli'
                },
                discoveryErrors: discoveryErrors,
            }
        }, ctx.log);
    }
    
    

    uploadScreenshot(
        { id: buildId, name: buildName, baseline }: Build,
        ssPath: string, ssName: string, browserName: string, viewport: string, url: string = '', log: Logger
    ) {
        browserName = browserName === constants.SAFARI ? constants.WEBKIT : browserName;
        const file = fs.readFileSync(ssPath);
        const form = new FormData();
        form.append('screenshot', file, { filename: `${ssName}.png`, contentType: 'image/png' });
        form.append('browser', browserName);
        form.append('viewport', viewport);
        form.append('buildId', buildId);
        form.append('buildName', buildName);
        form.append('screenshotName', ssName);
        form.append('baseline', baseline.toString());
        form.append('pageUrl',url)

        return this.axiosInstance.request({
            url: `/screenshot`,
            method: 'POST',
            headers: form.getHeaders(),
            data: form,
            timeout: 30000
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

    getS3PresignedURLForSnapshotUpload(ctx: Context, snapshotName: string, snapshotUuid: string) {
        return this.request({
            url: `/snapshotuploadurl`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: {
                buildId: ctx.build.id,
                snapshotName: snapshotName,
                snapshotUuid: snapshotUuid
            }
        }, ctx.log)
    }

    getS3PresignedURLForSnapshotUploadCaps(ctx: Context, snapshotName: string, snapshotUuid: string, capsBuildId: string, capsProjectToken: string) {
        return this.request({
            url: `/snapshotuploadurl`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                projectToken: capsProjectToken !== '' ? capsProjectToken : this.projectToken
            },
            data: {
                buildId: capsBuildId,
                snapshotName: snapshotName,
                snapshotUuid: snapshotUuid
            }
        }, ctx.log)
    }

    sendDomToLSRS(ctx: Context, snapshot: ProcessedSnapshot, snapshotUuid: string) {
        return this.request({
            url: `/upload/dom`,
            method: 'POST',
            data: {
                buildId: ctx.build.id,
                snapshotName: snapshot.name,
                snapshotUuid: snapshotUuid,
                domContent: snapshot,
                skipLogging: true
            }
        }, ctx.log);
    }

    sendDomToLSRSForCaps(ctx: Context, snapshot: ProcessedSnapshot, snapshotUuid: string, capsBuildId: string, capsProjectToken: string) {
        return this.request({
            url: `/upload/dom`,
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                projectToken: capsProjectToken !== '' ? capsProjectToken : this.projectToken
            },
            data: {
                buildId: capsBuildId,
                snapshotName: snapshot.name,
                snapshotUuid: snapshotUuid,
                domContent: snapshot,
                skipLogging: true
            }
        }, ctx.log);
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

    sendCliLogsToLSRS(ctx: Context) {
        const logContent = fs.readFileSync(constants.LOG_FILE_PATH, 'utf-8');

        return this.request({
            url: `/upload/logs`,
            method: 'POST',
            data: {
                buildId: ctx.build.id,
                logContent: logContent,
                skipLogging: true
            }
        }, ctx.log);
    }

    uploadSnapshotToS3(ctx: Context, uploadURL: string, snapshot: Snapshot) {
        return this.request({
            url: uploadURL,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            data: snapshot,
            maxBodyLength: Infinity, // prevent axios from limiting the body size
            maxContentLength: Infinity, // prevent axios from limiting the content size
        }, ctx.log)
    }

    uploadSnapshotToS3Caps(ctx: Context, uploadURL: string, snapshot: Snapshot, capsProjectToken: string) {
        return this.request({
            url: uploadURL,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                projectToken: capsProjectToken !== '' ? capsProjectToken : this.projectToken
            },
            data: snapshot,
            maxBodyLength: Infinity, // prevent axios from limiting the body size
            maxContentLength: Infinity, // prevent axios from limiting the content size
        }, ctx.log)
    }

    processWebFigma(requestBody: any, log: Logger) {
        requestBody.packageVersion = pkgJSON.version;
        return this.request({
            url: "figma-web/upload",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            data: JSON.stringify(requestBody)
        }, log);
    }

    fetchWebFigma(buildId: any, log: Logger) {
        return this.request({
            url: "figma-web/fetch",
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            params: { buildId }
        }, log);
    }

    fetchBuildInfo(requestData: any, ctx: Context) {
        return this.request({
            url: `/fetchBuildInfo`,
            method: 'GET',
            data: requestData
        }, ctx.log);
    }

    mergeBuildsByBuildId(requestData: any, ctx: Context) {
        return this.request({
            url: `/mergeBuilds`,
            method: 'POST',
            data: requestData
        }, ctx.log)
    }

    getSnapshotStatus(snapshotName: string, snapshotUuid: string, ctx: Context): Promise<Record<string, any>> {
        return this.request({
            url: `/snapshot/status?buildId=${ctx.build.id}&snapshotName=${snapshotName}&snapshotUUID=${snapshotUuid}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        }, ctx.log);
    }

    async uploadPdf(ctx: Context, form: FormData, buildName?: string): Promise<any> {
        form.append('projectToken', this.projectToken);
        if (ctx.build.name !== undefined && ctx.build.name !== '') {
            form.append('buildName', buildName);
        }

        try {
            const response = await this.axiosInstance.request({
                url: ctx.env.SMARTUI_UPLOAD_URL + '/pdf/upload',
                method: 'POST',
                headers: form.getHeaders(),
                data: form,
            });

            ctx.log.debug(`http response: ${JSON.stringify({
                status: response.status,
                headers: response.headers,
                body: response.data
            })}`);

            return response.data;
        } catch (error: any) {
            this.handleHttpError(error, ctx.log);
        }
    }

    async fetchPdfResults(ctx: Context): Promise<any> {
        const params: Record<string, string> = {};

        if (ctx.build.projectId) {
            params.project_id = ctx.build.projectId;
        } else {
            throw new Error('Project ID not found to fetch PDF results');
        }
        params.build_id = ctx.build.id;

        const auth = Buffer.from(`${this.username}:${this.accessKey}`).toString('base64');

        try {
            const response = await axios.request({
                url: ctx.env.SMARTUI_UPLOAD_URL + '/smartui/2.0/build/screenshots',
                method: 'GET',
                params: params,
                headers: {
                    'accept': 'application/json',
                    'Authorization': `Basic ${auth}`
                }
            });

            ctx.log.debug(`http response: ${JSON.stringify({
                status: response.status,
                headers: response.headers,
                body: response.data
            })}`);

            return response.data;
        } catch (error: any) {
            this.handleHttpError(error, ctx.log);
        }
    }
}

