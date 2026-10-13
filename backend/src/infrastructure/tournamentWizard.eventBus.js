const { EventEmitter } = require('node:events');

class TournamentWizardEventBus {
  constructor() {
    this.emitter = new EventEmitter();
  }

  publish(event) {
    this.emitter.emit(event.constructor.name, event);
  }

  subscribe(eventName, handler) {
    this.emitter.on(eventName, handler);
    return () => this.emitter.off(eventName, handler);
  }
}

module.exports = { TournamentWizardEventBus };
