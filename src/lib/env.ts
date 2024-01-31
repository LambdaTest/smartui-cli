import { Env } from '../types.js';

export default (): Env => {
    const {
        PROJECT_TOKEN = '',
        SMARTUI_CLIENT_API_URL = 'https://api.lambdatest.com/visualui/1.0',
        LT_SDK_LOG_LEVEL,
        LT_SDK_DEBUG
    } = process.env
        
    return {
        PROJECT_TOKEN,
        SMARTUI_CLIENT_API_URL,
        LT_SDK_LOG_LEVEL,
        LT_SDK_DEBUG
    }
}
