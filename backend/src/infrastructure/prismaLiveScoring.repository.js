const { PrismaClient } = require('@prisma/client');
const {
  CARD_POINTS,
  MUTATION_TYPES,
  MatchAggregate,
  KnockoutBracketEngine,
  MatchPeriod,
  Score,
  createMatchState,
  createMatchDomainEvent,
  decideWinner,
  getActionTarget,
  projectMatch,
  requiresKnockoutWinner,
} = require('../domain/liveScoring');

const prisma = new PrismaClient();
const matchInclude = {
  player1: { select: { id: true, name: true } },
  player2: { select: { id: true, name: true } },
  assignedReferee: { select: { id: true, name: true, username: true } },
  nextMatch: { select: { id: true, player1Id: true, player2Id: true } },
  tournament: { select: { id: true, title: true, format: true, organizerId: true } },
};

function conflict(message, current) {
  return Object.assign(new Error(message), { statusCode: 409, current });
}

function toEventJson(payload) {
  return JSON.parse(JSON.stringify(payload));
}

class PrismaLiveScoringRepository {
  async assignReferee(id, username, organizerId, role) {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      throw Object.assign(new Error('Podaj poprawną nazwę użytkownika sędziego.'), { statusCode: 400 });
    }
    const [match, referee] = await Promise.all([
      prisma.match.findUnique({ where: { id }, include: matchInclude }),
      prisma.user.findUnique({
        where: { username: normalizedUsername },
        select: { id: true, name: true, username: true, role: true },
      }),
    ]);
    if (!match) throw Object.assign(new Error('Nie znaleziono meczu.'), { statusCode: 404 });
    if (match.tournament.organizerId !== organizerId && role !== 'ADMIN') {
      throw Object.assign(new Error('Brak uprawnień do przydzielenia sędziego.'), { statusCode: 403 });
    }
    if (!referee || referee.role !== 'REFEREE') {
      throw Object.assign(new Error('Nie znaleziono konta sędziego o podanej nazwie użytkownika.'), { statusCode: 404 });
    }
    return prisma.match.update({
      where: { id },
      data: {
        assignedRefereeId: referee.id,
        refereeTokenHash: null,
        refereeTokenExpiresAt: null,
      },
      include: matchInclude,
    });
  }

  async unassignReferee(id, organizerId, role) {
    const match = await prisma.match.findUnique({ where: { id }, include: matchInclude });
    if (!match) throw Object.assign(new Error('Nie znaleziono meczu.'), { statusCode: 404 });
    if (match.tournament.organizerId !== organizerId && role !== 'ADMIN') {
      throw Object.assign(new Error('Brak uprawnień do usunięcia sędziego.'), { statusCode: 403 });
    }
    return prisma.match.update({
      where: { id },
      data: {
        assignedRefereeId: null,
        refereeTokenHash: null,
        refereeTokenExpiresAt: null,
      },
      include: matchInclude,
    });
  }

  async issueRefereeAccess(id, organizerId, tokenHash, role) {
    const match = await prisma.match.findUnique({ where: { id }, include: matchInclude });
    if (!match) throw Object.assign(new Error('Nie znaleziono meczu.'), { statusCode: 404 });
    if (match.tournament.organizerId !== organizerId && role !== 'ADMIN') {
      throw Object.assign(new Error('Brak uprawnień do przypisania sędziego.'), { statusCode: 403 });
    }
    const refereeTokenExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await prisma.match.update({ where: { id }, data: { refereeTokenHash: tokenHash, refereeTokenExpiresAt } });
    return { ...match, refereeTokenExpiresAt };
  }

  async revokeRefereeAccess(id, organizerId, role) {
    const match = await prisma.match.findUnique({ where: { id }, include: matchInclude });
    if (!match) throw Object.assign(new Error('Nie znaleziono meczu.'), { statusCode: 404 });
    if (match.tournament.organizerId !== organizerId && role !== 'ADMIN') {
      throw Object.assign(new Error('Brak uprawnień do unieważnienia dostępu sędziego.'), { statusCode: 403 });
    }
    await prisma.match.update({
      where: { id },
      data: { refereeTokenHash: null, refereeTokenExpiresAt: null },
    });
  }

  async getLiveMatch(id) {
    const match = await prisma.match.findUnique({
      where: { id },
      include: { ...matchInclude, events: { orderBy: { sequence: 'asc' } } },
    });
    if (!match) throw Object.assign(new Error('Nie znaleziono meczu.'), { statusCode: 404 });
    const { events, ...matchData } = match;
    return projectedMatch(matchData, events);
  }

  async getAssignedRefereeMatches(refereeId) {
    return prisma.match.findMany({
      where: { assignedRefereeId: refereeId },
      include: matchInclude,
      orderBy: [
        { tournament: { date: 'asc' } },
        { round: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async appendCommand({ id, actorId, command }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const duplicate = await tx.matchEvent.findUnique({ where: { commandId: command.commandId } });
        if (duplicate) {
          if (duplicate.matchId !== id) throw Object.assign(new Error('Identyfikator komendy został już użyty.'), { statusCode: 409 });
          return this.readProjectedMatch(tx, id);
        }

        const match = await tx.match.findUnique({
          where: { id },
          include: { ...matchInclude, events: { orderBy: { sequence: 'asc' } } },
        });
        if (!match) throw Object.assign(new Error('Nie znaleziono meczu.'), { statusCode: 404 });
        if (match.events.length !== command.expectedRevision) {
          throw conflict('Wynik zmienił się na innym urządzeniu. Zaktualizowano bieżący stan meczu.', projectMatch(match, match.events));
        }

        const state = new MatchAggregate(match, match.events).state;
        const next = createMatchState(state);
        let type = command.type;
        let payload = {};
        if (type === 'UNDO' || type === 'REDO') {
          const target = getActionTarget(match.events, type);
          if (!target) throw Object.assign(new Error(type === 'UNDO' ? 'Brak zmian do cofnięcia.' : 'Brak zmian do ponowienia.'), { statusCode: 400 });
          type = type === 'UNDO' ? 'ACTION_UNDONE' : 'ACTION_REDONE';
          payload = { targetEventId: target.id };
        } else if (MUTATION_TYPES.has(type)) {
          payload = buildNextState({ type, data: command.data || {}, match, state, next });
          payload = {
            before: createMatchState(state),
            after: payload,
            commandData: command.data || {},
          };
        } else {
          throw Object.assign(new Error('Nieobsługiwany typ zdarzenia meczowego.'), { statusCode: 400 });
        }

        const nextRevision = match.revision + 1;
        const claimed = await tx.match.updateMany({
          where: { id, revision: match.revision },
          data: { revision: nextRevision },
        });
        if (claimed.count !== 1) {
          const current = await this.readProjectedMatch(tx, id);
          throw conflict('Wynik zmienił się na innym urządzeniu. Spróbuj ponownie.', current);
        }

        const domainEvent = createMatchDomainEvent({
          commandId: command.commandId,
          matchId: id,
          sequence: nextRevision,
          type,
          payload: toEventJson(payload),
          actorId: actorId || null,
        });
        const event = await tx.matchEvent.create({
          data: {
            commandId: domainEvent.commandId,
            matchId: domainEvent.matchId,
            sequence: domainEvent.sequence,
            type: domainEvent.type,
            payload: domainEvent.payload,
            actorId: domainEvent.actorId,
          },
        });

        const events = [...match.events, event];
        const projected = projectMatch(match, events);
        const advancement = projected.status === 'FINISHED'
          ? new KnockoutBracketEngine().resolve(match, projected)
          : null;
        const winnerId = advancement?.winnerId || null;
        if (projected.status === 'FINISHED' && (match.nextMatchId || match.loserNextMatchId)) {
          if (advancement.winnerDestination) {
            await assignBracketSlot(tx, advancement.winnerDestination.matchId, advancement.winnerDestination.slot, advancement.winnerId);
          }
          if (advancement.loserDestination) {
            await assignBracketSlot(tx, advancement.loserDestination.matchId, advancement.loserDestination.slot, advancement.loserId);
          }
        } else if ((match.nextMatchId || match.loserNextMatchId) && match.status === 'FINISHED' && projected.status !== 'FINISHED') {
          const oldWinnerId = decideWinner(match, state);
          const oldLoserId = oldWinnerId === match.player1Id ? match.player2Id : match.player1Id;
          await clearBracketSlot(tx, match.nextMatchId, match.nextSlot, oldWinnerId);
          await clearBracketSlot(tx, match.loserNextMatchId, match.loserNextSlot, oldLoserId);
        }

        await tx.match.update({
          where: { id },
          data: {
            score1: projected.score1,
            score2: projected.score2,
            extraTimeScore1: projected.extraTimeScore1,
            extraTimeScore2: projected.extraTimeScore2,
            penaltyScore1: projected.penaltyScore1,
            penaltyScore2: projected.penaltyScore2,
            winnerId: projected.winnerId || (projected.status === 'FINISHED' ? decideWinner(match, projected) : null),
            status: projected.status,
            period: projected.period,
            clockSeconds: projected.clockSeconds,
            clockRunning: projected.clockRunning,
            clockStartedAt: projected.clockStartedAt ? new Date(projected.clockStartedAt) : null,
          },
        });
        return { ...(await this.readProjectedMatch(tx, id)), publishedEvent: event };
      });
    } catch (error) {
      if (error.code === 'P2002') {
        const duplicate = await prisma.matchEvent.findUnique({ where: { commandId: command.commandId } });
        if (duplicate?.matchId === id) return this.getLiveMatch(id);
      }
      throw error;
    }
  }

  async readProjectedMatch(tx, id) {
    const match = await tx.match.findUnique({
      where: { id },
      include: { ...matchInclude, events: { orderBy: { sequence: 'asc' } } },
    });
    if (!match) throw Object.assign(new Error('Nie znaleziono meczu.'), { statusCode: 404 });
    const { events, ...matchData } = match;
    return projectedMatch(matchData, events);
  }

  async getTournamentStandings(tournamentId) {
    const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw Object.assign(new Error('Nie znaleziono turnieju.'), { statusCode: 404 });
    if (tournament.status === 'DRAFT') {
      throw Object.assign(new Error('Tabela będzie dostępna po opublikowaniu turnieju.'), { statusCode: 404 });
    }
    const matches = await prisma.match.findMany({
      where: { tournamentId },
      include: { player1: { select: { id: true, name: true } }, player2: { select: { id: true, name: true } } },
    });
    const events = await prisma.matchEvent.findMany({
      where: { matchId: { in: matches.map((match) => match.id) } },
      orderBy: [{ matchId: 'asc' }, { sequence: 'asc' }],
    });
    return {
      tournamentId,
      format: tournament.format,
      standings: require('../domain/liveScoring').calculateStandings(matches, events),
    };
  }
}

function projectedMatch(match, events) {
  return {
    ...projectMatch(match, events),
    canUndo: Boolean(getActionTarget(events, 'UNDO')),
    canRedo: Boolean(getActionTarget(events, 'REDO')),
    eventHistory: events,
  };
}

async function assignBracketSlot(tx, matchId, slot, participantId) {
  if (!matchId || !participantId) return;
  const field = slot === 2 ? 'player2Id' : 'player1Id';
  await tx.match.update({ where: { id: matchId }, data: { [field]: participantId } });
}

async function clearBracketSlot(tx, matchId, slot, participantId) {
  if (!matchId || !participantId) return;
  const field = slot === 2 ? 'player2Id' : 'player1Id';
  const nextMatch = await tx.match.findUnique({ where: { id: matchId } });
  if (nextMatch?.[field] === participantId) {
    if (nextMatch.status !== 'SCHEDULED') {
      throw Object.assign(new Error('Nie można cofnąć awansu po rozpoczęciu kolejnego meczu.'), { statusCode: 409 });
    }
    await tx.match.update({ where: { id: matchId }, data: { [field]: null } });
  }
}

function buildNextState({ type, data, match, state, next }) {
  const scoreFields = ['score1', 'score2', 'extraTimeScore1', 'extraTimeScore2', 'penaltyScore1', 'penaltyScore2'];
  const parseScore = (value, name) => {
    if (!Number.isInteger(value) || value < 0 || value > 999) {
      throw Object.assign(new Error(`${name} musi być liczbą całkowitą od 0 do 999.`), { statusCode: 400 });
    }
    return value;
  };

  if (type === 'MATCH_STARTED') {
    if (state.status === 'FINISHED') throw Object.assign(new Error('Zakończonego meczu nie można uruchomić.'), { statusCode: 409 });
    requireParticipants(match);
    next.status = 'IN_PROGRESS';
    next.clockRunning = true;
    next.clockStartedAt = new Date();
  }

  if (type === 'BYE_ADVANCED') {
    const participants = [match.player1Id, match.player2Id].filter(Boolean);
    if (participants.length !== 1 || state.status === 'FINISHED') {
      throw Object.assign(new Error('Wolny los wymaga dokładnie jednego uczestnika.'), { statusCode: 409 });
    }
    next.status = 'FINISHED';
    next.winnerId = participants[0];
    next.clockRunning = false;
    next.clockStartedAt = null;
  }

  if (type === 'SCORE_CHANGED') {
    if (state.status === 'FINISHED') throw Object.assign(new Error('Nie można zmienić wyniku zakończonego meczu.'), { statusCode: 409 });
    requireParticipants(match);
    const scoreField = data.period === 'extraTime' ? `extraTimeScore${data.side}` : `score${data.side}`;
    if (!['score1', 'score2', 'extraTimeScore1', 'extraTimeScore2'].includes(scoreField)
      || ![-1, 1].includes(data.delta)) {
      throw Object.assign(new Error('Nieprawidłowa zmiana wyniku.'), { statusCode: 400 });
    }
    next[scoreField] = parseScore(state[scoreField] + data.delta, 'Wynik');
    if (next.status === 'SCHEDULED') next.status = 'IN_PROGRESS';
  }

  if (type === 'SCORE_SET') {
    if (state.status === 'FINISHED') throw Object.assign(new Error('Nie można zmienić wyniku zakończonego meczu.'), { statusCode: 409 });
    requireParticipants(match);
    for (const field of ['score1', 'score2', 'extraTimeScore1', 'extraTimeScore2']) {
      if (data[field] !== undefined) next[field] = parseScore(data[field], field);
    }
    for (const field of ['penaltyScore1', 'penaltyScore2']) {
      if (data[field] !== undefined) {
        next[field] = data[field] === null ? null : parseScore(data[field], field);
      }
    }
    new Score(next.score1, next.score2);
    if (next.status === 'SCHEDULED') next.status = 'IN_PROGRESS';
  }

  if (type === 'PERIOD_CHANGED') {
    try {
      next.period = new MatchPeriod(data.period).value;
    } catch {
      throw Object.assign(new Error('Podaj poprawną część meczu.'), { statusCode: 400 });
    }
  }

  if (type === 'CLOCK_CHANGED') {
    if (data.action === 'START') {
      next.clockRunning = true;
      next.clockStartedAt = new Date();
    } else if (data.action === 'PAUSE') {
      next.clockSeconds = elapsedSeconds(state);
      next.clockRunning = false;
      next.clockStartedAt = null;
    } else if (data.action === 'SET') {
      if (!Number.isInteger(data.seconds) || data.seconds < 0 || data.seconds > 36000) {
        throw Object.assign(new Error('Czas musi wynosić od 0 do 36000 sekund.'), { statusCode: 400 });
      }
      next.clockSeconds = data.seconds;
      next.clockStartedAt = state.clockRunning ? new Date() : null;
    } else {
      throw Object.assign(new Error('Nieprawidłowa operacja stopera.'), { statusCode: 400 });
    }
  }

  if (type === 'FOUL_CARD_ISSUED') {
    if (![match.player1Id, match.player2Id].includes(data.playerId)
      || !['YELLOW', 'RED'].includes(data.cardType)) {
      throw Object.assign(new Error('Nieprawidłowy zawodnik lub rodzaj kartki.'), { statusCode: 400 });
    }
    return { ...next, cardPoints: CARD_POINTS[data.cardType] };
  }

  if (type === 'MATCH_COMPLETED') {
    if (state.status === 'FINISHED') throw Object.assign(new Error('Mecz jest już zakończony.'), { statusCode: 409 });
    requireParticipants(match);
    for (const field of scoreFields) {
      if (data[field] !== undefined) next[field] = parseScore(data[field], field);
    }
    next.clockSeconds = elapsedSeconds(state);
    next.clockRunning = false;
    next.clockStartedAt = null;
    next.status = 'FINISHED';
    const winner = decideWinner(match, next);
    if (requiresKnockoutWinner(match) && !winner) {
      throw Object.assign(new Error('Mecz pucharowy musi mieć zwycięzcę. Wprowadź wyniki dogrywki lub rzutów karnych.'), { statusCode: 422 });
    }
  }

  function requireParticipants(match) {
    if (!match.player1Id || !match.player2Id) {
      throw Object.assign(new Error('Mecz nie ma jeszcze przypisanych obu uczestników.'), { statusCode: 409 });
    }
  }

  return next;
}

function elapsedSeconds(state) {
  if (!state.clockRunning || !state.clockStartedAt) return state.clockSeconds;
  return state.clockSeconds + Math.max(0, Math.floor((Date.now() - new Date(state.clockStartedAt).getTime()) / 1000));
}

module.exports = { PrismaLiveScoringRepository };
