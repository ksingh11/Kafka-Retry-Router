import { logger } from './lib/logger';
import { kafkaClient } from './lib/kafkaClient';

/**
 * Producer Init script
 */
export const KafkaProducer = kafkaClient.producer();
export const initProducer = async () => {
    await KafkaProducer.connect();
    logger.info("Kafka producer initialized");
    
    // boot test stub
    // init();
}

/**
 * Test stub
 */
const init = () => {
    setInterval(() => {publishCommonEvents("test", {type: "test", data: {"a": 1}});}, 2000);
}


export const publishCommonEvents = async (topic: string, {type, data}: any) => {
    logger.debug(`Kafka event push: [${topic}] ${JSON.stringify({type, data})}`);
    try {
        await KafkaProducer.send({
            acks: 1,
            topic: topic,
            messages: [
                { value: JSON.stringify({type, data}) },
            ],
        });
    } catch (e) {
        console.error(e);
        throw new Error(e);
    }
};
