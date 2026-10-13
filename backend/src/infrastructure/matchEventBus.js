const { EventEmitter } = require('node:events');

class MatchEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0);
  }

  publish(tournamentId, event) {
    this.emitter.emit(tournamentId, event);
  }

  subscribe(tournamentId, handler) {
    this.emitter.on(tournamentId, handler);
    return () => this.emitter.off(tournamentId, handler);
  }
}

module.exports = new MatchEventBus();
