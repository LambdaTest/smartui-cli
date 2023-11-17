import { Env } from '../types.js'
import { createLogger, format, transports } from 'winston'
import getEnv from '../lib/env.js'
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
    let debug: any = (env.SMARTUI_DEBUG === 'true') ? 'debug' : undefined;
    return debug || env.SMARTUI_LOG_LEVEL || 'info'
}

// Create a Winston logger
const logger = createLogger({
    level: logLevel(),
    format: format.combine(
    	format.timestamp(),
      	format.printf(info => {
			let contextString: string;
        	if (logContext && Object.keys(logContext).length) {
          		contextString = Object.values(logContext).join(' | ');
      		}
        	let message = `[${contextString}:${info.level}] `;
        	message += (info.message === 'object') ? JSON.stringify(info.message) : info.message;     
        	return message;
      	})
    ),
    transports: [new transports.File({ filename: 'smartui.log' })]
});

export default logger

