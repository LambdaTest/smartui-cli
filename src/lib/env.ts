import { Env } from '../types.js';

export default (): Env => {
    const {
        PROJECT_TOKEN = '',
        SMARTUI_CLIENT_API_URL = 'https://api.lambdatest.com',
        SMARTUI_LOG_LEVEL,
        SMARTUI_DEBUG
    } = process.env
        
    return {
        PROJECT_TOKEN,
        SMARTUI_CLIENT_API_URL,
        SMARTUI_LOG_LEVEL,
        SMARTUI_DEBUG
    }
}
