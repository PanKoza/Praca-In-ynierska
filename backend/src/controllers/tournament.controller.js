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

    const where = { status: { not: 'DRAFT' } };
    if (sportType) where.sportType = sportType;
    if (status === 'OPEN') where.status = { in: ['OPEN', 'PUBLISHED'] };
    else if (status && status !== 'DRAFT') where.status = status;

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
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        matches: {
          include: {
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
            assignedReferee: { select: { id: true, name: true, username: true } },
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

async function getOrganizerDashboard(req, res, next) {
  try {
    const where = req.user.role === 'ADMIN' ? {} : { organizerId: req.user.id };
    const tournaments = await prisma.tournament.findMany({
      where,
      include: {
        organizer: { select: { id: true, name: true } },
        participants: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { joinedAt: 'desc' },
        },
        matches: {
          include: {
            player1: { select: { id: true, name: true } },
            player2: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const stats = tournaments.reduce((summary, tournament) => {
      summary.tournaments += 1;
      summary.participants += tournament.participants.length;
      summary.matches += tournament.matches.length;
      summary.liveMatches += tournament.matches.filter((match) => match.status === 'IN_PROGRESS').length;
      summary.completedMatches += tournament.matches.filter((match) => match.status === 'FINISHED').length;
      summary.statuses[tournament.status] = (summary.statuses[tournament.status] || 0) + 1;
      return summary;
    }, {
      tournaments: 0,
      participants: 0,
      matches: 0,
      liveMatches: 0,
      completedMatches: 0,
      statuses: {},
    });

    const latestMatches = tournaments
      .flatMap((tournament) => tournament.matches.map((match) => ({
        ...match,
        tournament: { id: tournament.id, title: tournament.title, date: tournament.date },
      })))
      .sort((first, second) => second.updatedAt - first.updatedAt)
      .slice(0, 8);

    return res.json({ stats, tournaments, latestMatches });
  } catch (error) {
    return next(error);
  }
}

async function getPlayerDashboard(req, res, next) {
  try {
    const [participations, matches] = await Promise.all([
      prisma.tournamentParticipant.findMany({
        where: { userId: req.user.id },
        include: {
          tournament: {
            select: {
              id: true,
              title: true,
              description: true,
              date: true,
              endDate: true,
              sportType: true,
              status: true,
              location: true,
              format: true,
              maxParticipants: true,
              _count: { select: { participants: true, matches: true } },
            },
          },
        },
        orderBy: { tournament: { date: 'asc' } },
      }),
      prisma.match.findMany({
        where: {
          OR: [{ player1Id: req.user.id }, { player2Id: req.user.id }],
        },
        include: {
          player1: { select: { id: true, name: true } },
          player2: { select: { id: true, name: true } },
          tournament: {
            select: { id: true, title: true, date: true, status: true },
          },
        },
        orderBy: [
          { tournament: { date: 'asc' } },
          { round: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
    ]);

    return res.json({
      tournaments: participations.map(({ tournament, joinedAt }) => ({
        ...tournament,
        joinedAt,
      })),
      matches,
    });
  } catch (error) {
    return next(error);
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
    const { title, description, date, sportType, maxParticipants, status, location } = req.body;

    const existing = await prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }

    if (existing.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        message: 'Forbidden: only the organizer or an admin can update this tournament.',
      });
    }
    if (date !== undefined && Number.isNaN(new Date(date).getTime())) {
      return res.status(400).json({ message: 'Podaj prawidłową datę wydarzenia.' });
    }
    if (location !== undefined && location !== null
      && (typeof location !== 'string' || location.trim().length > 200)) {
      return res.status(400).json({ message: 'Lokalizacja może mieć maksymalnie 200 znaków.' });
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
        ...(location !== undefined && { location: location?.trim() || null }),
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
    if (!['OPEN', 'PUBLISHED'].includes(tournament.status)) {
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

async function removeTournamentParticipant(req, res, next) {
  try {
    const { id: tournamentId, userId } = req.params;
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, organizerId: true },
    });
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found.' });
    }
    if (tournament.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only the organizer or an admin can manage registrations.' });
    }

    const participant = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_userId: { tournamentId, userId } },
    });
    if (!participant) {
      return res.status(404).json({ message: 'Participant is not registered for this tournament.' });
    }

    const assignedMatch = await prisma.match.findFirst({
      where: { tournamentId, OR: [{ player1Id: userId }, { player2Id: userId }] },
      select: { id: true },
    });
    if (assignedMatch) {
      return res.status(409).json({ message: 'This participant is assigned to a match. Remove them from the schedule before cancelling registration.' });
    }

    await prisma.tournamentParticipant.delete({
      where: { tournamentId_userId: { tournamentId, userId } },
    });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
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
};
