class CreateTournamentDraftCommand {
  constructor(organizerId) {
    this.organizerId = organizerId;
  }
}

class SaveTournamentDraftCommand {
  constructor({ id, organizerId, data, step }) {
    Object.assign(this, { id, organizerId, data, step });
  }
}

class PublishTournamentCommand {
  constructor({ id, organizerId, data }) {
    Object.assign(this, { id, organizerId, data });
  }
}

module.exports = {
  CreateTournamentDraftCommand,
  PublishTournamentCommand,
  SaveTournamentDraftCommand,
};
