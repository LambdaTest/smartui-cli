import { Env } from '../types.js';

export default (): Env => {
    const {
        PROJECT_TOKEN = '',
        SMARTUI_CLIENT_API_URL = 'https://api.lambdatest.com/visualui/1.0',
        SMARTUI_GIT_INFO_FILEPATH,
        HTTP_PROXY,
        HTTPS_PROXY,
        GITHUB_ACTIONS,
        FIGMA_TOKEN,
        LT_USERNAME,
        LT_ACCESS_KEY,
        BASELINE_BRANCH,
        CURRENT_BRANCH
    } = process.env
        
    return {
        PROJECT_TOKEN,
        SMARTUI_CLIENT_API_URL,
        SMARTUI_GIT_INFO_FILEPATH,
        HTTP_PROXY,
        HTTPS_PROXY,
        GITHUB_ACTIONS,
        FIGMA_TOKEN,
        LT_USERNAME,
        LT_ACCESS_KEY,
        BASELINE_BRANCH,
        CURRENT_BRANCH,
    }
}
