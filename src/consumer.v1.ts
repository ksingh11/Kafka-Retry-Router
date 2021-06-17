import { kafkaClient } from "./lib/kafkaClient";
import { logger } from "./lib/logger";
import { globalStore } from "./lib/store";
import TimeNotReached from "./lib/TimeNotReached";

// consumer configurations
// const KAFKA_TOPICS = ['heyo', 'hello', 'test'];
const KAFKA_TOPICS = ['test'];
const KAFKA_GROUP_ID = 'group-retry-router';

/**
 * Kafka message handler.
 */
interface MessageHandler {
    (topic: string, message: any): void;
}


/**
 * Initialize kafka consumers for all the topics:
 * Bubble-up exception on fail.
 */
export const initializeConsumers = async () => {
    registerKafkaConsumer((topic, data) => {
        logger.info(` >>>> [${topic} Recv]: ${data}`);
    })
}

/**
 * initialise consumer.
 */
 export const registerKafkaConsumer = async (asyncMessageHandler: MessageHandler) => {
    
    const consumer = kafkaClient.consumer({ groupId: KAFKA_GROUP_ID });
    const producer = kafkaClient.producer({ 
        transactionalId: 'retry-transactional-client',
        maxInFlightRequests: 1, 
        idempotent: true 
    });

    await consumer.connect();
    await producer.connect();

    for (const kafkaTopic of KAFKA_TOPICS) {
        await consumer.subscribe({ topic: kafkaTopic, fromBeginning: true});
        console.log("Subscribed topic", kafkaTopic);
    }

    await consumer.run({
        autoCommit: false,
        eachBatchAutoResolve: false,

        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
            
            const {topic, partition, highWatermark, messages} = batch;
            console.log(`### GOT NEW BATCH`, topic, partition, isRunning(), isStale());

            try {
                for (let message of batch.messages) {

                    console.log({
                        topic: batch.topic,
                        partition: batch.partition,
                        highWatermark: batch.highWatermark,
                        message: {
                            offset: message.offset,
                            key: message.key,
                            value: message.value.toString(),
                            headers: message.headers,
                        }
                    });

                    await resolveOffset(message.offset);
                    await heartbeat();
                    
                    let transaction = undefined;
                    try {
                        transaction = await producer.transaction();
                        await transaction.send({ topic: 'heyo', messages: [{value: message.value.toString()}] });
                        await transaction.sendOffsets({
                            consumerGroupId: KAFKA_GROUP_ID,
                            topics: [{
                                topic: topic,
                                partitions: [{
                                    partition: partition,
                                    offset: (parseInt(message.offset) + 1).toString(),
                                }]
                            }],
                        });
                        await transaction.commit();
                    } catch (e) {
                        if (!transaction) {
                            console.log(e);
                        } else {
                            await transaction.abort();
                        }
                    }

                    // consumer.commitOffsets([{ topic, partition, offset: (parseInt(message.offset)+1).toString()}]);
                    
                    throw new TimeNotReached("Pause for now; discarding rest of this partition in current batch", (new Date()).getTime() / 1000);
                }
            } catch(e) {
                logger.error(e.message);
                if (e instanceof TimeNotReached) {                
                    consumer.pause([{topic: topic, partitions: [partition]}]);
                    setTimeout(() => {consumer.resume([{topic: topic, partitions: [partition]}])}, 5000);
                } 
            }
        },
    });
};
