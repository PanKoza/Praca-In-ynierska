const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tournamentInclude = {
  organizer: { select: { id: true, name: true } },
  _count: { select: { participants: true, matches: true } },
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/tournaments
 * Public. Supports ?sportType=&status= filters.
 */
async function listTournaments(req, res, next) {
  try {
    const { sportType, status } = req.query;

    const where = {};
    if (sportType) where.sportType = sportType;
    if (status) where.status = status;

    const tournaments = await prisma.tournament.findMany({
      where,
      include: tournamentInclude,
      orderBy: { date: 'asc' },
    });

    return res.json({ tournaments });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tournaments/:id
 * Public. Returns full detail including participants and matches.
 */
async function getTournament(req, res, next) {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true } },
        participants: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        matches: {
          include: {
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
          },
          orderBy: [{ round: 'asc' }, { createdAt: 'asc' }],
        },
        _count: { select: { participants: true } },
      },
    });

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }

    return res.json({ tournament });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tournaments
 * Requires ORGANIZER or ADMIN role.
 */
async function createTournament(req, res, next) {
  try {
    const { title, description, date, sportType, maxParticipants } = req.body;

    if (!title || !date || !sportType || !maxParticipants) {
      return res.status(400).json({
        message: 'title, date, sportType and maxParticipants are required.',
      });
    }

    const tournament = await prisma.tournament.create({
      data: {
        title,
        description: description ?? null,
        date: new Date(date),
        sportType,
        maxParticipants: parseInt(maxParticipants, 10),
        organizerId: req.user.id,
      },
      include: tournamentInclude,
    });

    return res.status(201).json({ tournament });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/tournaments/:id
 * Organizer (owner) or ADMIN only. Partial update.
 */
async function updateTournament(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, date, sportType, maxParticipants, status } = req.body;

    const existing = await prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }

    if (existing.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'Forbidden: only the organizer or an admin can update this tournament.',
      });
    }

    const tournament = await prisma.tournament.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(sportType !== undefined && { sportType }),
        ...(maxParticipants !== undefined && { maxParticipants: parseInt(maxParticipants, 10) }),
        ...(status !== undefined && { status }),
      },
      include: tournamentInclude,
    });

    return res.json({ tournament });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/tournaments/:id
 * Organizer (owner) or ADMIN only.
 */
async function deleteTournament(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }

    if (existing.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden.' });
    }

    await prisma.tournament.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tournaments/:id/join
 * PLAYER role. Registers the logged-in user for the tournament.
 */
async function joinTournament(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { _count: { select: { participants: true } } },
    });

    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }
    if (tournament.status !== 'OPEN') {
      return res.status(400).json({ message: 'Tournament is not open for registration.' });
    }
    if (tournament._count.participants >= tournament.maxParticipants) {
      return res.status(400).json({ message: 'Tournament is full.' });
    }

    const participation = await prisma.tournamentParticipant.create({
      data: { tournamentId: id, userId },
      include: { user: { select: { id: true, name: true } } },
    });

    return res.status(201).json({ message: 'Successfully joined the tournament.', participation });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'You are already registered for this tournament.' });
    }
    next(error);
  }
}

/**
 * DELETE /api/tournaments/:id/leave
 * Removes the logged-in player's registration.
 */
async function leaveTournament(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const participation = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_userId: { tournamentId: id, userId } },
    });

    if (!participation) {
      return res.status(404).json({ message: 'You are not registered for this tournament.' });
    }

    await prisma.tournamentParticipant.delete({
      where: { tournamentId_userId: { tournamentId: id, userId } },
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  joinTournament,
  leaveTournament,
};
