const express = require('express');
const {
  createRefereeAccess,
  assignReferee,
  getAssignedRefereeMatches,
  getLiveMatch,
  postMatchEvent,
  redoMatchEvent,
  revokeRefereeAccess,
  undoMatchEvent,
  unassignReferee,
} = require('../controllers/liveScoring.controller');
const { updateMatch, deleteMatch } = require('../controllers/match.controller');
const { matchAccess } = require('../middleware/match-access.middleware');
const { protect, optionalProtect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// PATCH /api/matches/:id  — update score / status (ORGANIZER or ADMIN)
router.patch('/:id', protect, authorize('ORGANIZER', 'ADMIN'), updateMatch);
router.delete('/:id', protect, authorize('ORGANIZER', 'ADMIN'), deleteMatch);
router.get('/assigned', protect, authorize('REFEREE'), getAssignedRefereeMatches);
router.get('/:id/live', optionalProtect, matchAccess, getLiveMatch);
router.post('/:id/events', optionalProtect, matchAccess, postMatchEvent);
router.post('/:id/undo', optionalProtect, matchAccess, undoMatchEvent);
router.post('/:id/redo', optionalProtect, matchAccess, redoMatchEvent);
router.post('/:id/referee-access', protect, authorize('ORGANIZER', 'ADMIN'), createRefereeAccess);
router.delete('/:id/referee-access', protect, authorize('ORGANIZER', 'ADMIN'), revokeRefereeAccess);
router.put('/:id/referee', protect, authorize('ORGANIZER', 'ADMIN'), assignReferee);
router.delete('/:id/referee', protect, authorize('ORGANIZER', 'ADMIN'), unassignReferee);

module.exports = router;
