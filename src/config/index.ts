/* eslint-disable no-console,import/imports-first */
require('dotenv').config();

const env = process.env.NODE_ENV || 'dev';
const kafkaBrokerString = (process.env.KAFKA_BROKERS_LIST || 'localhost:9092').trim()
const kafkaBrokerList = kafkaBrokerString.split(",").map(broker => broker.trim());

const config = {
  // env info
  env,
  // Server options used to start Hapi server
  server: {
    name: 'Kafka Retry Router',
    version: '1.0.0',
  },
  
  kafka: {
    host: kafkaBrokerList,
    consumerGroup: (process.env.CONSUMER_GROUP_NAME || "retry-router-group").trim(),
    producerTransactionId: (process.env.PRODUCER_TRANSACTION_ID || "retry-transactional-client").trim(),
    delayTimedeltaSec: parseInt(process.env.DELAY_TIMEDELTA_SEC || "2"),
    fallbackTopic: process.env.KAFKA_FALLBACK_TOPIC
  },

  syslog: {
    host: process.env.SYSLOG_HOST || "logs2.papertrailapp.com",
    port: parseInt(process.env.SYSLOG_PORT || "33333"),
    appName: process.env.SYSLOG_APPNAME || "kafka-retry",
    localhost: process.env.SYSLOG_LOCAL_HOSTNAME || "local-docker"
  }
};

export default config;
