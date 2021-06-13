/**
 * In-memory global data store
 */

type consumers = {
    [key: string]: object
}

class GlobalStore {
    consumers: consumers;

    constructor() {
        this.consumers = {};
    }
}

export const globalStore = new GlobalStore();