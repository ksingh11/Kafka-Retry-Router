
export type QueueConfig = {
    queue: string,
    ttlSec: number
}

export type TtlCache = {
  [key: string]: number
}

/**
 * Read retry queue config from environment and make it readable
 * expecting config in format: retry1:5;retry2
 * @returns QueueConfig[]
 */
 export const getRetryQueues = () => {
    const queueString  = process.env.RETRY_QUEUE_CONFIG;
    const queues: QueueConfig[] = [];
    const ttlCache: TtlCache = {};

    queueString
      .split(";")
      .forEach((queueBlock) => {
        let [queue, ttl] = queueBlock.split(":"); 
        const queueName = queue.trim();
        const ttlSec = parseInt(ttl);

        if (queueName.length && ttlSec) {
          queues.push({queue: queueName, ttlSec: ttlSec});
          ttlCache[queue] = ttlSec;
        }
      });
    return {queues, ttlCache};
  }