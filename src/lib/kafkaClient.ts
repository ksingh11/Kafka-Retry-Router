import {Kafka, logLevel} from "kafkajs";
import os from "os";
import config from "../config";
import { logger, WinstonLogCreator } from "./logger";

const clientId = os.hostname();
logger.info(`Brokers: ${JSON.stringify(config.kafka.host)}, Client: ${clientId}`);

/**
 * Configure Kafka client
 */
export const kafkaClient = new Kafka({
    clientId: clientId,
    brokers: config.kafka.host,
    // logLevel: logLevel.DEBUG,
    // logCreator: WinstonLogCreator
});
