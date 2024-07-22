import { createLogger, format, transports, log } from 'winston'
import constants from './constants.js'
import { Env } from '../types.js'
import getEnv from './env.js'
import chalk from 'chalk'

interface LogContext {
  task?: string;
}

let logContext: LogContext = {};

// Function to update context
export function updateLogContext(newContext: LogContext) {
	logContext = { ...logContext, ...newContext };
}

const logLevel = (): string => {
    let env: Env = getEnv();
    return (env.LT_SDK_DEBUG === 'true') ? 'debug' : 'info';
}

// Create a Winston logger
const logger = createLogger({
    format: format.combine(
    	format.timestamp(),
      	format.printf(info => {
			let contextString = Object.values(logContext).join(' | ');
        	let message = (typeof info.message === 'object') ? JSON.stringify(info.message).trim() : info.message.trim();
			switch (info.level) {
				case 'warn':
					message = chalk.yellow(message);
					break;
			}
        	return (info.level === 'info') ? message : `[${contextString}:${info.level}] ` + message;
      	})
    ),
    transports: [
		new transports.Console({
			level: logLevel()
		}),
		new transports.File({
			level: 'debug',
			filename: constants.LOG_FILE_PATH
		})]
});

export default logger
