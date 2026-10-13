const { PrismaTournamentWizardRepository } = require('../infrastructure/prismaTournamentWizard.repository');
const { TournamentWizardEventBus } = require('../infrastructure/tournamentWizard.eventBus');
const { TournamentWizardService } = require('../application/tournamentWizard.service');
const {
  CreateTournamentDraftCommand,
  PublishTournamentCommand,
  SaveTournamentDraftCommand,
} = require('../application/tournamentWizard.commands');

const service = new TournamentWizardService(
  new PrismaTournamentWizardRepository(),
  new TournamentWizardEventBus(),
);

async function createDraft(req, res, next) {
  try {
    const draft = await service.createDraft(new CreateTournamentDraftCommand(req.user.id).organizerId);
    return res.status(201).json({ draft });
  } catch (error) {
    return next(error);
  }
}

async function getDraft(req, res, next) {
  try {
    const draft = await service.getDraft(req.params.id, req.user.id);
    return res.json({ draft });
  } catch (error) {
    return next(error);
  }
}

async function saveDraft(req, res, next) {
  try {
    const { data, step, fromStep } = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ message: 'Pole data musi być obiektem.' });
    }
    const draft = await service.saveDraft(new SaveTournamentDraftCommand({
      id: req.params.id,
      organizerId: req.user.id,
      data,
      step,
      fromStep,
    }));
    return res.json({ draft });
  } catch (error) {
    return next(error);
  }
}

async function previewStructure(req, res, next) {
  try {
    const structure = await service.preview(req.params.id, req.user.id);
    return res.json({ structure });
  } catch (error) {
    return next(error);
  }
}

async function publishDraft(req, res, next) {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ message: 'Pole data musi być obiektem.' });
    }
    const tournament = await service.publish(new PublishTournamentCommand({
      id: req.params.id,
      organizerId: req.user.id,
      data,
    }));
    return res.json({ tournament });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createDraft, getDraft, publishDraft, previewStructure, saveDraft };
