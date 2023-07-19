import { createLogger, transports, format } from 'winston';

const setupLogger = async () => {
  const { default: chalk } = await import('chalk');

  function loglevel(){
      let level = process.env.SMARTUI_LOG_LEVEL;
      let debug = process.env.SMARTUI_DEBUG;
      if (debug === 'true') {
        return 'debug'
      } else if(level){
        return level
      } else {
        return 'info'
      }
  }

  const logger = createLogger({
    level: loglevel(),
    format: format.combine(
      format.timestamp(),
      format.printf(({ level, message, timestamp }) => {
        let colorizedMessage;
        if (typeof message === 'object') {
          message = JSON.stringify(message);
        }
        switch (level) {
          case 'info':
            colorizedMessage = message;
            break;
          case 'debug':
              colorizedMessage = chalk.blue(message);
              break;
          case 'warn':
            colorizedMessage = chalk.yellow(message);
            break;
          case 'error':
            colorizedMessage = chalk.red(message);
            break;
          default:
            colorizedMessage = message;
            break;
        }
        return `[smartui] ${colorizedMessage}`;
      })
    ),
    transports: [new transports.Console()]
  });
  return logger;
};



export {setupLogger};