//@ts-nocheck
import config from "../config";

const os = require("os");
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, json } = format;
require('winston-syslog').Syslog;

// config
const hostName = os.hostname();
const level = process.env.LOG_LEVEL || 'info';
const syslogOptions = {
    host: "logs2.papertrailapp.com",
    port: 33292,
    app_name: "hdl-be",
    localhost: hostName
};
const errorStackFormat = format(info => {
    if (info instanceof Error) {
      return Object.assign({}, info, {
        stack: info.stack,
        message: info.message
      })
    }
    return info
  });


// Setup winston
const logger = createLogger({
    level: level,
    format: combine(
        timestamp(),
        format.json(),
        errorStackFormat()
    ),
    defaultMeta: { host: hostName }
});

// central logs stream access; eg. for morgan:
logger.stream = {
    write: function(message: string, encoding: string){
        logger.info(message);
    }
};

// log development logs to console:
if (config.env === 'prod') {
    const files = new transports.File({filename: 'logs/combined.log', level: level});
    logger.add(files);

    try {
        const syslog = new transports.Syslog(syslogOptions);
        logger.add(syslog)
    } catch (e) {
        console.log("Papertrails init failed.")
    }

} else {
    logger.add(
        new transports.Console({
            level: level,
            colorize: true,
            timestamp: function () {
                return (new Date()).toISOString();
            }
        })
    );
}

//Kafka JS log config
const WinstonLogCreator = logLevel => {
    const logger = createLogger({
        level: 'debug',
        transports: [
            new transports.Console(),
            // new transports.File({ filename: 'myapp.log' })
        ],
        format: combine(timestamp(),format.json(),errorStackFormat())
    })

    return ({ namespace, level, label, log }) => {
        const { message, ...extra } = log
        logger.log({
            level: 'debug',
            message,
            extra,
        })
    }
}

// export logger
export {
    logger,
    WinstonLogCreator
}
