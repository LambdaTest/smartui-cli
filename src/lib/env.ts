import { Env } from '../types.js';

export default (): Env => {
    const {
        PROJECT_TOKEN = '',
        SMARTUI_CLIENT_API_URL = 'https://api.lambdatest.com/visualui/1.0',
        LT_SDK_LOG_LEVEL,
        LT_SDK_DEBUG,
        SMARTUI_GIT_INFO_FILEPATH,
        HTTP_PROXY,
        HTTPS_PROXY,
        GITHUB_ACTIONS,
        FIGMA_TOKEN,
        LT_USERNAME,
        LT_ACCESS_KEY
    } = process.env
        
    return {
        PROJECT_TOKEN,
        SMARTUI_CLIENT_API_URL,
        LT_SDK_LOG_LEVEL,
        LT_SDK_DEBUG,
        SMARTUI_GIT_INFO_FILEPATH,
        HTTP_PROXY,
        HTTPS_PROXY,
        GITHUB_ACTIONS,
        FIGMA_TOKEN,
        LT_USERNAME,
        LT_ACCESS_KEY
    }
}
