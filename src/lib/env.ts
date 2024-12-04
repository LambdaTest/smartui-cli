import { Env } from '../types.js';

export default (): Env => {
    const {
        PROJECT_TOKEN = '',
        SMARTUI_CLIENT_API_URL = 'https://api.lambdatest.com/visualui/1.0',
        SMARTUI_GIT_INFO_FILEPATH,
        SMARTUI_DO_NOT_USE_CAPTURED_COOKIES,
        HTTP_PROXY,
        HTTPS_PROXY,
        SMARTUI_HTTP_PROXY,
        SMARTUI_HTTPS_PROXY,
        GITHUB_ACTIONS,
        FIGMA_TOKEN,
        LT_USERNAME,
        LT_ACCESS_KEY,
        LT_SDK_DEBUG,
        BASELINE_BRANCH,
        CURRENT_BRANCH,
        PROJECT_NAME
    } = process.env
        
    return {
        PROJECT_TOKEN,
        SMARTUI_CLIENT_API_URL,
        SMARTUI_GIT_INFO_FILEPATH,
        HTTP_PROXY,
        HTTPS_PROXY,
        SMARTUI_HTTP_PROXY,
        SMARTUI_HTTPS_PROXY,
        GITHUB_ACTIONS,
        FIGMA_TOKEN,
        LT_USERNAME,
        LT_ACCESS_KEY,
        BASELINE_BRANCH,
        CURRENT_BRANCH,
        LT_SDK_DEBUG: LT_SDK_DEBUG === 'true',
        SMARTUI_DO_NOT_USE_CAPTURED_COOKIES: SMARTUI_DO_NOT_USE_CAPTURED_COOKIES === 'true',
        PROJECT_NAME
    }
}
