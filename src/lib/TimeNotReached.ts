/**
 * When messages are ahead of time
 */
class TimeNotReached extends Error {  
    constructor(public message: string, public messageTS: number) {
      super(message);
      this.messageTS = messageTS;
      this.name = "TimeNotReached";
      this.stack = (<any> new Error()).stack;
      Object.setPrototypeOf(this, TimeNotReached.prototype);
    }
  
  }
  
  export default TimeNotReached;