const { PrismaClient } = require('@prisma/client');
const { randomInt, randomUUID } = require('node:crypto');
const { LiveScoringService, publicMatch } = require('../application/liveScoring.service');
const { generateAutomaticSchedule } = require('../domain/automaticSchedule');
const {
  createMatchState,
  decideWinner,
  requiresKnockoutWinner,
} = require('../domain/liveScoring');
const matchEventBus = require('../infrastructure/matchEventBus');

const prisma = new PrismaClient();
const liveScoring = new LiveScoringService();

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
    const {
      player1Id,
      player2Id,
      bye = false,
      round,
      groupKey,
      nextMatchId,
      nextSlot,
      loserNextMatchId,
      loserNextSlot,
      court,
      scheduledAt,
    } = req.body;

    if (typeof bye !== 'boolean') {
      return res.status(400).json({ message: 'The bye flag must be a boolean.' });
    }
    if (bye && Boolean(player1Id) === Boolean(player2Id)) {
      return res.status(400).json({ message: 'A bye match must have exactly one participant.' });
    }
    if (round !== undefined && (!Number.isInteger(Number(round)) || Number(round) < 1 || Number(round) > 64)) {
      return res.status(400).json({ message: 'Round must be a whole number between 1 and 64.' });
    }
    if (scheduledAt !== undefined && scheduledAt !== null
      && (typeof scheduledAt !== 'string' || !scheduledAt.trim())) {
      return res.status(400).json({ message: 'Podaj prawidłowy termin meczu.' });
    }
    const parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (scheduledAt && Number.isNaN(parsedScheduledAt.getTime())) {
      return res.status(400).json({ message: 'Podaj prawidłowy termin meczu.' });
    }
    for (const playerId of [player1Id, player2Id].filter(Boolean)) {
      const participant = await prisma.tournamentParticipant.findUnique({
        where: { tournamentId_userId: { tournamentId, userId: playerId } },
      });
      if (!participant) {
        return res.status(400).json({ message: 'Match participants must be registered for this tournament.' });
      }
    }
    if (player1Id && player2Id && player1Id === player2Id) {
      return res.status(400).json({ message: 'A player cannot compete against themselves.' });
    }
    for (const [targetId, slot] of [[nextMatchId, nextSlot], [loserNextMatchId, loserNextSlot]]) {
      if ((targetId && ![1, 2].includes(Number(slot))) || (!targetId && slot !== undefined)) {
        return res.status(400).json({ message: 'Each bracket destination needs a target match and slot 1 or 2.' });
      }
      if (targetId === req.params.id) {
        return res.status(400).json({ message: 'A match cannot advance into itself.' });
      }
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

    for (const targetId of [nextMatchId, loserNextMatchId].filter(Boolean)) {
      const target = await prisma.match.findUnique({ where: { id: targetId }, select: { tournamentId: true } });
      if (!target || target.tournamentId !== tournamentId) {
        return res.status(400).json({ message: 'Bracket destination must belong to the same tournament.' });
      }
    }
    if (nextMatchId && loserNextMatchId
      && nextMatchId === loserNextMatchId && Number(nextSlot) === Number(loserNextSlot)) {
      return res.status(400).json({ message: 'Winner and loser cannot advance to the same slot.' });
    }
    for (const [targetId, slot] of [[nextMatchId, nextSlot], [loserNextMatchId, loserNextSlot]]) {
      if (!targetId) continue;
      const target = await prisma.match.findUnique({ where: { id: targetId } });
      if (!target) return res.status(409).json({ message: 'Bracket destination is no longer available.' });
      const slotField = Number(slot) === 2 ? 'player2Id' : 'player1Id';
      if (target[slotField]) {
        return res.status(409).json({ message: 'Bracket destination slot is already occupied.' });
      }
      const existingSource = await prisma.match.findFirst({
        where: {
          tournamentId,
          OR: [
            { nextMatchId: targetId, nextSlot: Number(slot) },
            { loserNextMatchId: targetId, loserNextSlot: Number(slot) },
          ],
        },
      });
      if (existingSource) {
        return res.status(409).json({ message: 'Another match is already assigned to this bracket slot.' });
      }
    }

    const match = await prisma.match.create({
      data: {
        tournamentId,
        player1Id: player1Id || null,
        player2Id: player2Id || null,
        round: round ? parseInt(round, 10) : 1,
        groupKey: groupKey || null,
        nextMatchId: nextMatchId || null,
        nextSlot: nextSlot ? Number(nextSlot) : null,
        loserNextMatchId: loserNextMatchId || null,
        loserNextSlot: loserNextSlot ? Number(loserNextSlot) : null,
        court: court || null,
        scheduledAt: parsedScheduledAt,
      },
      include: matchInclude,
    });

    const createdMatch = bye
      ? publicMatch(await liveScoring.execute(match.id, req.user.id, {
        commandId: randomUUID(),
        expectedRevision: 0,
        type: 'BYE_ADVANCED',
      }))
      : match;

    return res.status(201).json({ match: createdMatch });
  } catch (error) {
    next(error);
  }
}

async function generateTournamentSchedule(req, res, next) {
  try {
    const { tournamentId } = req.params;
    const generated = await prisma.$transaction(async (tx) => {
      const [lockedTournament] = await tx.$queryRaw`
        SELECT "id" FROM "tournaments" WHERE "id" = ${tournamentId} FOR UPDATE
      `;
      if (!lockedTournament) {
        throw Object.assign(new Error('Tournament not found.'), { statusCode: 404 });
      }

      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          participants: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { joinedAt: 'asc' },
          },
          _count: { select: { matches: true } },
        },
      });
      if (tournament.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw Object.assign(new Error('Only the organizer or an admin can generate this schedule.'), { statusCode: 403 });
      }
      if (tournament._count.matches) {
        throw Object.assign(new Error('Ten wydarzenie ma już mecze. Usuń lub zakończ obecny harmonogram przed utworzeniem nowego.'), { statusCode: 409 });
      }

      let participants = tournament.participants.map(({ user: participant }) => participant);
      if (tournament.seeding === 'RANDOM') {
        for (let index = participants.length - 1; index > 0; index -= 1) {
          const swapIndex = randomInt(index + 1);
          [participants[index], participants[swapIndex]] = [participants[swapIndex], participants[index]];
        }
      }

      const schedule = generateAutomaticSchedule(tournament.format, participants);
      const idByKey = new Map(schedule.rounds.flat().map((match) => [match.key, randomUUID()]));
      const matches = schedule.rounds.flatMap((round) => round.map((match) => ({
        ...match,
        id: idByKey.get(match.key),
        tournamentId,
        nextMatchId: match.nextMatchId ? idByKey.get(match.nextMatchId) : null,
        nextSlot: match.nextSlot || null,
        loserNextMatchId: match.loserNextMatchId ? idByKey.get(match.loserNextMatchId) : null,
        loserNextSlot: match.loserNextSlot || null,
        status: 'SCHEDULED',
      })));

      for (const match of matches) {
        await tx.match.create({
          data: {
            id: match.id,
            tournamentId,
            player1Id: match.player1Id,
            player2Id: match.player2Id,
            round: match.round,
            groupKey: match.groupKey,
            status: match.status,
          },
        });
      }

      for (const match of matches) {
        if (!match.nextMatchId && !match.loserNextMatchId) continue;
        await tx.match.update({
          where: { id: match.id },
          data: {
            nextMatchId: match.nextMatchId,
            nextSlot: match.nextSlot,
            loserNextMatchId: match.loserNextMatchId,
            loserNextSlot: match.loserNextSlot,
          },
        });
      }

      const slotsByMatch = new Map(matches.map((match) => [
        match.id,
        { player1Id: match.player1Id, player2Id: match.player2Id },
      ]));
      const byeEvents = [];
      for (const match of [...matches].sort((first, second) => first.round - second.round)) {
        const slots = slotsByMatch.get(match.id);
        if (Boolean(slots.player1Id) === Boolean(slots.player2Id)) continue;

        const winnerId = slots.player1Id || slots.player2Id;
        const before = createMatchState({
          ...match,
          ...slots,
          status: 'SCHEDULED',
          score1: 0,
          score2: 0,
          extraTimeScore1: 0,
          extraTimeScore2: 0,
          penaltyScore1: null,
          penaltyScore2: null,
          winnerId: null,
        });
        const after = {
          ...before,
          status: 'FINISHED',
          winnerId,
          clockRunning: false,
          clockStartedAt: null,
        };
        await tx.matchEvent.create({
          data: {
            commandId: randomUUID(),
            matchId: match.id,
            sequence: 1,
            type: 'BYE_ADVANCED',
            payload: { before, after, commandData: {} },
            actorId: req.user.id,
          },
        });
        await tx.match.update({
          where: { id: match.id },
          data: { status: 'FINISHED', winnerId, revision: 1 },
        });
        byeEvents.push({ matchId: match.id, revision: 1 });

        const destinationId = match.nextMatchId;
        if (destinationId) {
          const destinationSlots = slotsByMatch.get(destinationId);
          const slotField = match.nextSlot === 2 ? 'player2Id' : 'player1Id';
          if (destinationSlots[slotField]) {
            throw Object.assign(new Error('Nie można wygenerować drabinki: slot awansu jest już zajęty.'), { statusCode: 409 });
          }
          destinationSlots[slotField] = winnerId;
          await tx.match.update({ where: { id: destinationId }, data: { [slotField]: winnerId } });
        }
      }

      return {
        tournamentId,
        format: schedule.format,
        groups: schedule.groups,
        rounds: schedule.rounds.length,
        matchCount: matches.length,
        byeCount: byeEvents.length,
        byeEvents,
      };
    }, { isolationLevel: 'Serializable' });

    for (const event of generated.byeEvents) {
      matchEventBus.publish(tournamentId, {
        type: 'MATCH_UPDATED',
        matchId: event.matchId,
        revision: event.revision,
      });
    }
    matchEventBus.publish(tournamentId, {
      type: 'SCHEDULE_GENERATED',
      matchId: `schedule-${tournamentId}`,
      revision: generated.matchCount,
    });

    const { byeEvents, ...summary } = generated;
    return res.status(201).json({ schedule: summary });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/matches/:id
 * ORGANIZER or ADMIN. Updates score and/or status of a match.
 * Body: { score1?, score2?, extraTimeScore1?, extraTimeScore2?, penaltyScore1?, penaltyScore2?, status? }
 */
async function updateMatch(req, res, next) {
  try {
    const { id } = req.params;
    const {
      player1Id,
      player2Id,
      round,
      groupKey,
      court,
      scheduledAt,
    } = req.body;
    const {
      score1,
      score2,
      extraTimeScore1,
      extraTimeScore2,
      penaltyScore1,
      penaltyScore2,
      status,
    } = req.body;

    const existing = await prisma.match.findUnique({
      where: { id },
      include: { tournament: { select: { organizerId: true, format: true } } },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Match not found.' });
    }
    if (existing.tournament.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const structuralDetailsProvided = [
      player1Id,
      player2Id,
      round,
      groupKey,
    ].some((value) => value !== undefined);
    const scheduleDetailsProvided = court !== undefined || scheduledAt !== undefined;
    if (structuralDetailsProvided && existing.status !== 'SCHEDULED') {
      return res.status(409).json({ message: 'Uczestników, grupę i rundę można zmieniać tylko przed rozpoczęciem meczu.' });
    }
    if (round !== undefined && (!Number.isInteger(Number(round)) || Number(round) < 1 || Number(round) > 64)) {
      return res.status(400).json({ message: 'Runda musi być liczbą całkowitą od 1 do 64.' });
    }
    for (const [field, value] of [['player1Id', player1Id], ['player2Id', player2Id]]) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return res.status(400).json({ message: `${field} nie jest prawidłowym identyfikatorem uczestnika.` });
      }
    }
    for (const [field, value] of [['groupKey', groupKey], ['court', court]]) {
      if (value !== undefined && value !== null
        && (typeof value !== 'string' || value.trim().length > 80)) {
        return res.status(400).json({ message: `${field} musi mieć maksymalnie 80 znaków.` });
      }
    }
    if (scheduledAt !== undefined && scheduledAt !== null
      && (typeof scheduledAt !== 'string' || !scheduledAt.trim())) {
      return res.status(400).json({ message: 'Podaj prawidłowy termin meczu.' });
    }
    const parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (scheduledAt && Number.isNaN(parsedScheduledAt.getTime())) {
      return res.status(400).json({ message: 'Podaj prawidłowy termin meczu.' });
    }
    const nextPlayer1Id = player1Id === undefined ? existing.player1Id : player1Id || null;
    const nextPlayer2Id = player2Id === undefined ? existing.player2Id : player2Id || null;
    if (nextPlayer1Id && nextPlayer2Id && nextPlayer1Id === nextPlayer2Id) {
      return res.status(400).json({ message: 'Jeden uczestnik nie może grać przeciwko sobie.' });
    }
    for (const participantId of [nextPlayer1Id, nextPlayer2Id].filter(Boolean)) {
      const participant = await prisma.tournamentParticipant.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId: existing.tournamentId,
            userId: participantId,
          },
        },
        select: { id: true },
      });
      if (!participant) {
        return res.status(400).json({ message: 'Obaj uczestnicy muszą być zapisani na to wydarzenie.' });
      }
    }

    if (existing.status === 'FINISHED' && status !== 'FINISHED') {
      return res.status(400).json({ message: 'A finished match cannot be re-opened.' });
    }

    if (status !== undefined && !['SCHEDULED', 'IN_PROGRESS', 'FINISHED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid match status.' });
    }
    const parsedScores = {
      score1: score1 === undefined ? existing.score1 || 0 : Number(score1),
      score2: score2 === undefined ? existing.score2 || 0 : Number(score2),
      extraTimeScore1: extraTimeScore1 === undefined
        ? existing.extraTimeScore1 || 0
        : Number(extraTimeScore1),
      extraTimeScore2: extraTimeScore2 === undefined
        ? existing.extraTimeScore2 || 0
        : Number(extraTimeScore2),
      penaltyScore1: penaltyScore1 === undefined
        ? existing.penaltyScore1
        : penaltyScore1 === null ? null : Number(penaltyScore1),
      penaltyScore2: penaltyScore2 === undefined
        ? existing.penaltyScore2
        : penaltyScore2 === null ? null : Number(penaltyScore2),
    };
    const regularAndExtraScores = [
      parsedScores.score1,
      parsedScores.score2,
      parsedScores.extraTimeScore1,
      parsedScores.extraTimeScore2,
    ];
    const penaltyScores = [parsedScores.penaltyScore1, parsedScores.penaltyScore2];
    if (!regularAndExtraScores.every((score) => Number.isInteger(score) && score >= 0 && score <= 999)
      || !penaltyScores.every((score) => score === null || (Number.isInteger(score) && score >= 0 && score <= 999))) {
      return res.status(400).json({ message: 'Scores must be whole numbers between 0 and 999.' });
    }
    if (status === 'FINISHED' && existing.status !== 'FINISHED'
      && requiresKnockoutWinner(existing) && !decideWinner(existing, parsedScores)) {
      return res.status(422).json({
        message: 'Mecz pucharowy musi mieć zwycięzcę. Wprowadź wynik dogrywki lub rzutów karnych.',
      });
    }
    if (structuralDetailsProvided || scheduleDetailsProvided) {
      const updateResult = await prisma.match.updateMany({
        where: {
          id,
          ...(structuralDetailsProvided ? { status: 'SCHEDULED' } : {}),
        },
        data: {
          ...(player1Id !== undefined && { player1Id: nextPlayer1Id }),
          ...(player2Id !== undefined && { player2Id: nextPlayer2Id }),
          ...(round !== undefined && { round: Number(round) }),
          ...(groupKey !== undefined && { groupKey: groupKey?.trim() || null }),
          ...(court !== undefined && { court: court?.trim() || null }),
          ...(scheduledAt !== undefined && { scheduledAt: parsedScheduledAt }),
        },
      });
      if (updateResult.count !== 1) {
        return res.status(409).json({ message: 'Mecz rozpoczął się i nie można zmienić jego uczestników, grupy ani rundy.' });
      }
      matchEventBus.publish(existing.tournamentId, {
        type: 'MATCH_UPDATED',
        matchId: id,
        revision: existing.revision,
      });
    }

    let current = await liveScoring.getLiveMatch(id);
    const scoreWasProvided = [
      score1,
      score2,
      extraTimeScore1,
      extraTimeScore2,
      penaltyScore1,
      penaltyScore2,
    ].some((score) => score !== undefined);
    if (scoreWasProvided) {
      current = await liveScoring.execute(id, req.user.id, {
        commandId: randomUUID(),
        expectedRevision: current.revision,
        type: 'SCORE_SET',
        data: parsedScores,
      });
    }
    if (status === 'IN_PROGRESS' && current.status !== 'IN_PROGRESS') {
      current = await liveScoring.execute(id, req.user.id, {
        commandId: randomUUID(),
        expectedRevision: current.revision,
        type: 'MATCH_STARTED',
      });
    }
    if (status === 'FINISHED' && current.status !== 'FINISHED') {
      current = await liveScoring.execute(id, req.user.id, {
        commandId: randomUUID(),
        expectedRevision: current.revision,
        type: 'MATCH_COMPLETED',
        data: {},
      });
    }

    return res.json({ match: publicMatch(current) });
  } catch (error) {
    next(error);
  }
}

async function deleteMatch(req, res, next) {
  try {
    const { id } = req.params;
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        tournament: { select: { id: true, organizerId: true } },
      },
    });

    if (!match) {
      return res.status(404).json({ message: 'Nie znaleziono meczu.' });
    }
    if (match.tournament.organizerId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Tylko organizator wydarzenia lub administrator może usunąć mecz.' });
    }
    if (match.status !== 'SCHEDULED') {
      return res.status(409).json({ message: 'Można usuwać wyłącznie mecze, które jeszcze się nie rozpoczęły.' });
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.match.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current || current.status !== 'SCHEDULED') {
        throw Object.assign(new Error('Mecz rozpoczął się i nie może zostać usunięty.'), { statusCode: 409 });
      }

      await tx.match.updateMany({
        where: { nextMatchId: id },
        data: { nextMatchId: null, nextSlot: null },
      });
      await tx.match.updateMany({
        where: { loserNextMatchId: id },
        data: { loserNextMatchId: null, loserNextSlot: null },
      });

      const deletion = await tx.match.deleteMany({
        where: { id, status: 'SCHEDULED' },
      });
      if (deletion.count !== 1) {
        throw Object.assign(new Error('Mecz rozpoczął się i nie może zostać usunięty.'), { statusCode: 409 });
      }
    });

    matchEventBus.publish(match.tournament.id, {
      type: 'MATCH_UPDATED',
      matchId: id,
      deleted: true,
      revision: match.revision + 1,
    });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = { listMatches, createMatch, generateTournamentSchedule, updateMatch, deleteMatch };
