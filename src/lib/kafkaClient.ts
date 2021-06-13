import {Kafka, logLevel} from "kafkajs";
import os from "os";
import config from "../config";
import { WinstonLogCreator } from "./logger";

const clientId = os.hostname();

/**
 * Configure Kafka client
 */
export const kafkaClient = new Kafka({
    clientId: clientId,
    brokers: config.kafka.host,
    // logLevel: logLevel.DEBUG,
    // logCreator: WinstonLogCreator
});
