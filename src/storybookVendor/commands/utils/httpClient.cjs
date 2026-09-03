const axios = require('axios');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

let proxyUrl = null;

try {
    const SMARTUI_API_PROXY = process.env.SMARTUI_API_PROXY;
    if (SMARTUI_API_PROXY) {
        const urlStr = SMARTUI_API_PROXY.startsWith('http') ?
            SMARTUI_API_PROXY : `http://${SMARTUI_API_PROXY}`;
        proxyUrl = new URL(urlStr);
    }
} catch (error) {
    console.error('[smartui] Invalid proxy URL:', error.message);
}

const skipCertificates = process.env.SMARTUI_API_SKIP_CERTIFICATES === 'true';

const axiosConfig = {};

if (proxyUrl) {
    const agentOptions = {
        rejectUnauthorized: !skipCertificates
    };

    axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl, agentOptions);
    axiosConfig.httpAgent = new HttpProxyAgent(proxyUrl,agentOptions);
} else if (skipCertificates) {
    axiosConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });
}

const httpClient = axios.create(axiosConfig);

module.exports = { httpClient };

