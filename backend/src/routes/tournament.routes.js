const express = require('express');
const {
  listTournaments,
  getTournament,
  getOrganizerDashboard,
  getPlayerDashboard,
  createTournament,
  updateTournament,
  deleteTournament,
  joinTournament,
  leaveTournament,
  removeTournamentParticipant,
} = require('../controllers/tournament.controller');
const {
  listMatches,
  createMatch,
  generateTournamentSchedule,
} = require('../controllers/match.controller');
const {
  createDraft,
  getDraft,
  publishDraft,
  previewStructure,
  saveDraft,
} = require('../controllers/tournamentWizard.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const {
  getStandings,
  streamTournamentEvents,
} = require('../controllers/liveScoring.controller');

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get('/', listTournaments);
router.get('/organizer/dashboard', protect, authorize('ORGANIZER', 'ADMIN'), getOrganizerDashboard);
router.get('/player/dashboard', protect, authorize('PLAYER'), getPlayerDashboard);
router.get('/:id', getTournament);
router.get('/:tournamentId/matches', listMatches);
router.get('/:tournamentId/standings', getStandings);
router.get('/:tournamentId/live-events', streamTournamentEvents);

// ─── Organizer / Admin ────────────────────────────────────────────────────────
router.post('/drafts', protect, authorize('ORGANIZER', 'ADMIN'), createDraft);
router.get('/drafts/:id', protect, authorize('ORGANIZER', 'ADMIN'), getDraft);
router.patch('/drafts/:id', protect, authorize('ORGANIZER', 'ADMIN'), saveDraft);
router.get('/drafts/:id/preview', protect, authorize('ORGANIZER', 'ADMIN'), previewStructure);
router.post('/drafts/:id/publish', protect, authorize('ORGANIZER', 'ADMIN'), publishDraft);
router.post('/', protect, authorize('ORGANIZER', 'ADMIN'), createTournament);
router.patch('/:id', protect, authorize('ORGANIZER', 'ADMIN'), updateTournament);
router.delete('/:id', protect, authorize('ORGANIZER', 'ADMIN'), deleteTournament);
router.post('/:tournamentId/matches', protect, authorize('ORGANIZER', 'ADMIN'), createMatch);
router.post('/:tournamentId/generate-schedule', protect, authorize('ORGANIZER', 'ADMIN'), generateTournamentSchedule);

// ─── Player ───────────────────────────────────────────────────────────────────
router.post('/:id/join', protect, authorize('PLAYER'), joinTournament);
router.delete('/:id/leave', protect, authorize('PLAYER'), leaveTournament);
router.delete('/:id/participants/:userId', protect, authorize('ORGANIZER', 'ADMIN'), removeTournamentParticipant);

module.exports = router;
