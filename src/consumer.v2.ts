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

        eachMessage: async ({ topic, partition, message }) => {
            
            console.log({
              partition,
              offset: message.offset,
              value: message.value.toString(),
            });
    
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
          },
    });
};
