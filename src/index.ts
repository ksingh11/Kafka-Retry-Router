import { initAdmin } from './admin';
import { logger } from './lib/logger';
import { initializeConsumers } from './consumer';

/**
 * Initialize kafka producer and consumer
 */
const main = async () => {
    await initAdmin();
    // await initProducer();
    await initializeConsumers();
}

/**
 * Main boot function
 */
main().catch(e => {
    logger.error(`Exiting server!!! ${e.message}`);
    process.exit();
});
