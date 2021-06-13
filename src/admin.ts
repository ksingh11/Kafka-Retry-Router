import {kafkaClient} from "./lib/kafkaClient";
import { logger } from "./lib/logger";

// Initialize kafka admin
const admin = kafkaClient.admin()
const topics = [
    {
        topic: "heyo",
        numPartitions: 3,
        replicationFactor: 1
    },
    {
        topic: "hello",
        numPartitions: 3,
        replicationFactor: 1
    }
]

/**
 * Initialize Admin
 */
export const initAdmin = async () => {
  await admin.connect()
  logger.info("[ADMIN] Kafka admin connected");

  const created = await admin.createTopics({
    topics: topics,
    waitForLeaders: true,
  });

  logger.info(`[ADMIN] Kafka topics: ${created? "Created": "Already Exists"}`);
}