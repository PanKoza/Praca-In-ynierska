const express = require('express');
const { updateMatch } = require('../controllers/match.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// PATCH /api/matches/:id  — update score / status (ORGANIZER or ADMIN)
router.patch('/:id', protect, authorize('ORGANIZER', 'ADMIN'), updateMatch);

module.exports = router;
