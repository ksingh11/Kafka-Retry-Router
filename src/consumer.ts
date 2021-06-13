import config from "./config";
import { kafkaClient } from "./lib/kafkaClient";
import { logger } from "./lib/logger";
import { getRetryQueues, QueueConfig, TtlCache } from "./lib/queueUtils";
import TimeNotReached from "./lib/TimeNotReached";

const fallbackConfig = config.kafka.fallbackTopic;
const fallbackTopic = (typeof fallbackConfig === "string" && fallbackConfig.length) ? fallbackConfig : false;

/**
 * Initialize kafka consumers for all the topics:
 * Bubble-up exception on fail.
 */
export const initializeConsumers = async () => {
    const {queues, ttlCache} = getRetryQueues();
    await registerKafkaConsumer(queues, ttlCache);
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialise consumer Router: Works in exactly-one semantics
 * Fetches message according to scheduled time, using pause/resume feature of kafka.
 * 
 * - Transaction-Aware Consumer
 * - Commit transation by batch
 * 
 * For batch consumption: discard message (noack) those have been retrieved ahead of time.
 * - Also discard all message in that particular partition.
 */
 export const registerKafkaConsumer = async (queues: QueueConfig[], ttlCache: TtlCache) => {
    const topicList = queues.map(item => item.queue);
    const delayDelta = config.kafka.delayTimedeltaSec;

    // Intialize consumer and producer
    const consumer = kafkaClient.consumer({ groupId: config.kafka.consumerGroup });
    const producer = kafkaClient.producer({ 
        transactionalId: config.kafka.producerTransactionId,
        maxInFlightRequests: 1, 
        idempotent: true 
    });

    await consumer.connect();
    await producer.connect();

    // subscribe for topics
    logger.info(`Consumer Group: ${config.kafka.consumerGroup}`);
    logger.info(`Transaction Id: ${config.kafka.producerTransactionId} `);
    logger.info(`Subscribing for topics: ${topicList}} `);

    for (const kafkaTopic of topicList) {
        await consumer.subscribe({ topic: kafkaTopic, fromBeginning: true});
        logger.info(`Subscribed topic: ${kafkaTopic}`);
    }

    let transaction: any;

    await consumer.run({
        autoCommit: false,
        eachBatchAutoResolve: false,

        // process messages in batch
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
            const {topic, partition, highWatermark, messages} = batch;
            logger.debug(`### GOT NEW BATCH: ${topic}, ${partition}, #${batch.messages.length} msg, ${isRunning()}, ${isStale()}`);
            
            try {
                if (!(transaction && transaction.isActive())) {
                    logger.debug("Starting new transaction..");
                    transaction = await producer.transaction();
                }
                
                const currentTimestamp = Math.round((new Date()).getTime() / 1000);
                let messageSentCount = 0;
                
                // process individual message
                try {
                    for (let message of batch.messages) {
                        const data = {
                            topic: batch.topic,
                            partition: batch.partition,
                            highWatermark: batch.highWatermark,
                            message: {
                                offset: message.offset,
                                key: message.key,
                                value: message.value.toString(),
                                headers: message.headers,
                            },
                            time: new Date().toString()
                        };
                        logger.debug(`[Message Data]: ${JSON.stringify(data)}`);
                        
                        // Mark message consumed & heartbeat
                        await resolveOffset(message.offset);
                        await heartbeat();

                        // read header and process message
                        const headers = message.headers;
                        const {msg_ts, final_topic} = headers;
                        let finalTopic: string;
                        let messageTS: number;
                        try {
                            if (final_topic && final_topic.toString().length) {
                                finalTopic = final_topic.toString()
                            }
                            if (msg_ts && msg_ts.toString().length) {
                                messageTS = parseInt(msg_ts.toString())
                            }
                        } catch (e) {
                            logger.error(e);
                        }

                        if (!finalTopic && fallbackTopic) {
                            finalTopic = fallbackTopic
                        }

                        logger.debug(`Routing for: ${topic} -> ${finalTopic}: ttl: ${messageTS}`);

                        // Validate time: skip message all next in current partition.
                        const topicTTL = ttlCache[topic];
                        if (messageTS && (currentTimestamp < messageTS + topicTTL)) {
                            throw new TimeNotReached("Time not reached", messageTS);
                        }

                        // send transaction message to destination_topic and commit
                        if (finalTopic) {
                            await transaction.send({
                                topic: finalTopic, 
                                messages: [{value: message.value.toString()}]
                            });
                            messageSentCount += 1;
                        } else {
                            // just log and move ahead
                            logger.error(`[NO TOPICS]: ${JSON.stringify(data)}`);
                        }

                        await transaction.sendOffsets({
                            consumerGroupId: config.kafka.consumerGroup,
                            topics: [
                                { topic: topic,
                                    partitions: [{
                                            partition: partition,
                                            offset: (parseInt(message.offset) + 1).toString(),
                                    }]
                                }],
                            });
                    }
                } catch(e) {
                    if (e instanceof TimeNotReached) {
                        // Pause consumer and schedule to resume after the configured retry time for topic.
                        const messageTS = e.messageTS;
                        const scheduledTime = messageTS + ttlCache[topic];
                        const pendingTime = scheduledTime - currentTimestamp;
                        const resumeTTL = pendingTime + delayDelta;

                        consumer.pause([{topic: topic, partitions: [partition]}]);
                        setTimeout(() => {consumer.resume([{topic: topic, partitions: [partition]}])}, resumeTTL * 1000);
                    } 
                }
                
                // commit transaction for the current entire batch.
                logger.debug("About to commit transaction.", messageSentCount);
                if (messageSentCount > 0 && transaction && transaction.isActive()) {
                    await transaction.commit();
                }
            } catch (e) {
                logger.error(`Got an Error: ${e}`);                
                if (transaction && transaction.isActive()) {
                    try {
                        await transaction.abort();
                    } catch (err) {
                        if (err.code !== 48) {
                            throw err
                        }
                    }
                }
            }
        },
    });
};
