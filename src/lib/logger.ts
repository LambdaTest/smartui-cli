import { Env } from '../types.js'
import { createLogger, format, transports } from 'winston'
import getEnv from '../lib/env.js'
import chalk from 'chalk'

interface LogContext {
  task?: string;
}

let logContext: LogContext = { task: 'smartui-cli' };

// Function to update context
export function updateLogContext(newContext: LogContext) {
	logContext = { ...logContext, ...newContext };
}

const logLevel = (): string => {
    let env: Env = getEnv();
    let debug: any = (env.LT_SDK_DEBUG === 'true') ? 'debug' : undefined;
    return debug || env.LT_SDK_LOG_LEVEL || 'info'
}

// Create a Winston logger
const logger = createLogger({
    level: logLevel(),
    format: format.combine(
    	format.timestamp(),
      	format.printf(info => {
			let contextString = Object.values(logContext).join(' | ');
        	let message = (typeof info.message === 'object') ? JSON.stringify(info.message) : info.message;
			switch (info.level) {
				case 'debug':
					message = chalk.blue(message);
					break;
				case 'warn':
					message = chalk.yellow(message);
					break;
				case 'error':
					message = chalk.red(message);
					break;
			}
        	return (info.level === 'info') ? message : `[${contextString}:${info.level}] ` + message;
      	})
    ),
    transports: [new transports.Console()]
});

export default logger
