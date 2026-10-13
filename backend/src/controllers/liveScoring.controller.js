const { LiveScoringService, publicMatch } = require('../application/liveScoring.service');
const eventBus = require('../infrastructure/matchEventBus');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const service = new LiveScoringService();

async function getLiveMatch(req, res, next) {
  try {
    return res.json({ match: publicMatch(await service.getLiveMatch(req.params.id), true) });
  } catch (error) {
    return next(error);
  }
}

async function getAssignedRefereeMatches(req, res, next) {
  try {
    const matches = await service.getAssignedRefereeMatches(req.user.id);
    return res.json({ matches: matches.map((match) => publicMatch(match)) });
  } catch (error) {
    return next(error);
  }
}

async function postMatchEvent(req, res, next) {
  try {
    const { commandId, expectedRevision, type, data } = req.body;
    const match = await service.execute(req.params.id, req.matchActor.id, {
      commandId,
      expectedRevision,
      type,
      data,
    });
    return res.json({ match: publicMatch(match, true) });
  } catch (error) {
    return next(error);
  }
}

async function undoMatchEvent(req, res, next) {
  return postControlEvent(req, res, next, 'UNDO');
}

async function redoMatchEvent(req, res, next) {
  return postControlEvent(req, res, next, 'REDO');
}

async function postControlEvent(req, res, next, type) {
  try {
    const { commandId, expectedRevision } = req.body;
    const match = await service.execute(req.params.id, req.matchActor.id, {
      commandId,
      expectedRevision,
      type,
    });
    return res.json({ match: publicMatch(match, true) });
  } catch (error) {
    return next(error);
  }
}

async function createRefereeAccess(req, res, next) {
  try {
    const grant = await service.issueRefereeAccess(req.params.id, req.user.id, req.user.role);
    return res.status(201).json(grant);
  } catch (error) {
    return next(error);
  }
}

async function revokeRefereeAccess(req, res, next) {
  try {
    await service.revokeRefereeAccess(req.params.id, req.user.id, req.user.role);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function assignReferee(req, res, next) {
  try {
    const match = await service.assignReferee(
      req.params.id,
      req.body.username,
      req.user.id,
      req.user.role,
    );
    return res.json({ match: publicMatch(match) });
  } catch (error) {
    return next(error);
  }
}

async function unassignReferee(req, res, next) {
  try {
    const match = await service.unassignReferee(req.params.id, req.user.id, req.user.role);
    return res.json({ match: publicMatch(match) });
  } catch (error) {
    return next(error);
  }
}

async function getStandings(req, res, next) {
  try {
    return res.json({ ...await service.getStandings(req.params.tournamentId) });
  } catch (error) {
    return next(error);
  }
}

async function streamTournamentEvents(req, res, next) {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: req.params.tournamentId },
      select: { id: true, status: true },
    });
    if (!tournament || tournament.status === 'DRAFT') {
      return res.status(404).json({ message: 'Nie znaleziono opublikowanego turnieju.' });
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ tournamentId: tournament.id })}\n\n`);
    const unsubscribe = eventBus.subscribe(tournament.id, (event) => {
      res.write(`id: ${event.matchId}:${event.revision}\nevent: match-updated\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createRefereeAccess,
  assignReferee,
  getAssignedRefereeMatches,
  getLiveMatch,
  getStandings,
  postMatchEvent,
  redoMatchEvent,
  revokeRefereeAccess,
  streamTournamentEvents,

  undoMatchEvent,
  unassignReferee,
};
