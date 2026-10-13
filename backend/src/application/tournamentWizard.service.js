const {
  assertStepTransition,
  buildTournament,
  getStructurePreview,
  TournamentCreatedEvent,
  validateDraft,
  WizardStepCompletedEvent,
} = require('../domain/tournamentWizard');

class TournamentWizardService {
  constructor(repository, eventBus) {
    this.repository = repository;
    this.eventBus = eventBus;
  }

  createDraft(organizerId) {
    const data = {};
    return this.repository.createDraft(organizerId, data);
  }

  async getDraft(id, organizerId) {
    const draft = await this.repository.findDraft(id, organizerId);
    if (!draft) throw Object.assign(new Error('Nie znaleziono szkicu wydarzenia.'), { statusCode: 404 });
    return {
      ...draft,
      wizardData: draft.wizardData || {},
      wizardStep: draft.wizardStep || 1,
    };
  }

  async saveDraft({ id, organizerId, data, step, fromStep }) {
    const draft = await this.getDraft(id, organizerId);
    const requestedStep = step === undefined ? draft.wizardStep : Number(step);
    const previousStep = fromStep === undefined ? draft.wizardStep : Number(fromStep);
    assertStepTransition(draft.wizardStep, requestedStep, data, previousStep);
    const completedStep = Math.max(draft.wizardStep, requestedStep);
    const updated = await this.repository.updateDraft(id, data, completedStep);
    if (completedStep > draft.wizardStep) {
      this.eventBus.publish(new WizardStepCompletedEvent(id, previousStep, organizerId));
    }
    return updated;
  }

  async preview(id, organizerId) {
    const draft = await this.getDraft(id, organizerId);
    const data = draft.wizardData || {};
    const errors = validateDraft(data);
    if (Object.keys(errors).length) {
      throw Object.assign(new Error('Uzupełnij poprawnie wszystkie kroki kreatora.'), {
        statusCode: 422,
        details: errors,
      });
    }
    return getStructurePreview(data.format, Number(data.maxParticipants));
  }

  async publish({ id, organizerId, data }) {
    const draft = await this.getDraft(id, organizerId);
    assertStepTransition(draft.wizardStep, 4, data, Math.min(3, draft.wizardStep));
    const tournamentData = buildTournament(data);
    const result = await this.repository.publishDraft(id, organizerId, tournamentData, data);
    if (result.count !== 1) {
      throw Object.assign(new Error('Szkic nie jest już dostępny do publikacji.'), { statusCode: 409 });
    }
    const tournament = await this.repository.findPublishedTournament(id, organizerId);
    this.eventBus.publish(new TournamentCreatedEvent(id, organizerId));
    return tournament;
  }
}

module.exports = { TournamentWizardService };
