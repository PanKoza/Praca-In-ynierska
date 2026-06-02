const express = require('express');
const {
  listTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  joinTournament,
  leaveTournament,
} = require('../controllers/tournament.controller');
const { listMatches, createMatch } = require('../controllers/match.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get('/', listTournaments);
router.get('/:id', getTournament);
router.get('/:tournamentId/matches', listMatches);

// ─── Organizer / Admin ────────────────────────────────────────────────────────
router.post('/', protect, authorize('ORGANIZER', 'ADMIN'), createTournament);
router.patch('/:id', protect, authorize('ORGANIZER', 'ADMIN'), updateTournament);
router.delete('/:id', protect, authorize('ORGANIZER', 'ADMIN'), deleteTournament);
router.post('/:tournamentId/matches', protect, authorize('ORGANIZER', 'ADMIN'), createMatch);

// ─── Player ───────────────────────────────────────────────────────────────────
router.post('/:id/join', protect, authorize('PLAYER'), joinTournament);
router.delete('/:id/leave', protect, authorize('PLAYER'), leaveTournament);

module.exports = router;
