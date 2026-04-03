import { createLogger, format, transports, log } from 'winston'
import stringify  from 'json-stringify-safe'
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
	return (env.LT_SDK_DEBUG || env.LT_SDK_DEBUG_SMARTUI_CLI) ? 'debug' : 'info';
}

// Create a Winston logger
const logger = createLogger({
	format: format.combine(
		format.timestamp(),
		format.printf(info => {
			let contextString = Object.values(logContext).join(' | ');
			let message = (typeof info.message === 'object') ? stringify(info.message) : info.message.trim();
			switch (info.level) {
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
	transports: [
		new transports.Console({
			level: logLevel()
		}),
		new transports.File({
			level: 'debug',
			filename: constants.LOG_FILE_PATH
		})]
});

/**
 * Reconfigure the file transport to use a different log file path.
 * Used when --createUniqueLogFile flag is set to avoid file lock issues
 * during parallel CLI executions on Windows.
 */
export function removeFileTransport(): void {
	logger.transports.forEach((transport) => {
		if (transport instanceof transports.File) {
			logger.remove(transport);
		}
	});
}

export function reconfigureLogFile(newFilePath: string): void {
	// Remove existing file transport
	logger.transports.forEach((transport) => {
		if (transport instanceof transports.File) {
			logger.remove(transport);
		}
	});
	// Add new file transport with the unique log file path
	logger.add(new transports.File({
		level: 'debug',
		filename: newFilePath
	}));
}

export default logger
