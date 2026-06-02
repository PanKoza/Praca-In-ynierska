const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const matchInclude = {
  player1: { select: { id: true, name: true } },
  player2: { select: { id: true, name: true } },
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/tournaments/:tournamentId/matches
 * Public. Returns all matches for a tournament, ordered by round.
 */
async function listMatches(req, res, next) {
  try {
    const { tournamentId } = req.params;

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }

    const matches = await prisma.match.findMany({
      where: { tournamentId },
      include: matchInclude,
      orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
    });

    return res.json({ matches });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tournaments/:tournamentId/matches
 * ORGANIZER (owner) or ADMIN. Creates a single match within a tournament.
 * Body: { player1Id, player2Id, round? }
 */
async function createMatch(req, res, next) {
  try {
    const { tournamentId } = req.params;
    const { player1Id, player2Id, round } = req.body;

    if (!player1Id || !player2Id) {
      return res.status(400).json({ message: 'player1Id and player2Id are required.' });
    }
    if (player1Id === player2Id) {
      return res.status(400).json({ message: 'A player cannot compete against themselves.' });
    }

    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }
    if (tournament.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'Forbidden: only the organizer or an admin can create matches.',
      });
    }

    const match = await prisma.match.create({
      data: {
        tournamentId,
        player1Id,
        player2Id,
        round: round ? parseInt(round, 10) : 1,
      },
      include: matchInclude,
    });

    return res.status(201).json({ match });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/matches/:id
 * ORGANIZER or ADMIN. Updates score and/or status of a match.
 * Body: { score1?, score2?, status? }
 */
async function updateMatch(req, res, next) {
  try {
    const { id } = req.params;
    const { score1, score2, status } = req.body;

    const existing = await prisma.match.findUnique({
      where: { id },
      include: { tournament: { select: { organizerId: true } } },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Match not found.' });
    }
    if (existing.tournament.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    if (existing.status === 'FINISHED' && status !== 'FINISHED') {
      return res.status(400).json({ message: 'A finished match cannot be re-opened.' });
    }

    const match = await prisma.match.update({
      where: { id },
      data: {
        ...(score1 !== undefined && { score1: parseInt(score1, 10) }),
        ...(score2 !== undefined && { score2: parseInt(score2, 10) }),
        ...(status !== undefined && { status }),
      },
      include: matchInclude,
    });

    return res.json({ match });
  } catch (error) {
    next(error);
  }
}

module.exports = { listMatches, createMatch, updateMatch };
