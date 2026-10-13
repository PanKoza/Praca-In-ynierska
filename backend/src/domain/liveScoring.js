const MUTATION_TYPES = new Set([
  'MATCH_STARTED',
  'SCORE_CHANGED',
  'SCORE_SET',
  'BYE_ADVANCED',
  'PERIOD_CHANGED',
  'CLOCK_CHANGED',
  'FOUL_CARD_ISSUED',
  'MATCH_COMPLETED',
]);
const CONTROL_TYPES = new Set(['ACTION_UNDONE', 'ACTION_REDONE']);
const CARD_POINTS = { YELLOW: 1, RED: 3 };

class Score {
  constructor(home = 0, away = 0) {
    if (![home, away].every((value) => Number.isInteger(value) && value >= 0 && value <= 999)) {
      throw new RangeError('Scores must be whole numbers between 0 and 999.');
    }
    this.home = home;
    this.away = away;
    Object.freeze(this);
  }
}

class MatchPeriod {
  constructor(value) {
    const period = String(value || '').trim();
    if (!period || period.length > 24) throw new RangeError('A match period must contain 1 to 24 characters.');
    this.value = period;
    Object.freeze(this);
  }
}

class MatchEvent {
  constructor({ id, commandId, matchId, sequence, type, payload, actorId, createdAt }) {
    Object.assign(this, { id, commandId, matchId, sequence, type, payload, actorId, createdAt });
    Object.freeze(this);
  }
}

class MatchStartedEvent extends MatchEvent {
  constructor(event) { super({ ...event, type: 'MATCH_STARTED' }); }
}

class ScoreUpdatedEvent extends MatchEvent {
  constructor(event) { super({ ...event, type: event.type }); }
}

class FoulCardIssuedEvent extends MatchEvent {
  constructor(event) { super({ ...event, type: 'FOUL_CARD_ISSUED' }); }
}

class MatchCompletedEvent extends MatchEvent {
  constructor(event) { super({ ...event, type: 'MATCH_COMPLETED' }); }
}

class MatchAggregate {
  constructor(match, events) {
    this.state = projectMatch(match, events);
    this.winnerId = decideWinner(match, this.state);
  }
}

class KnockoutBracketEngine {
  resolve(match, state) {
    const winnerId = decideWinner(match, state);
    if ((match.nextMatchId || match.loserNextMatchId || requiresKnockoutWinner(match)) && !winnerId) {
      throw new RangeError('A knockout match must have a winner.');
    }
    const loserId = winnerId && match.player1Id && match.player2Id
      ? (winnerId === match.player1Id ? match.player2Id : match.player1Id)
      : null;
    return {
      winnerId,
      loserId,
      winnerDestination: match.nextMatchId ? { matchId: match.nextMatchId, slot: match.nextSlot || 1 } : null,
      loserDestination: match.loserNextMatchId ? { matchId: match.loserNextMatchId, slot: match.loserNextSlot || 1 } : null,
    };
  }
}

function requiresKnockoutWinner(match) {
  if (match.tournament?.format === 'GROUP_STAGE' && match.groupKey) return false;
  return ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION'].includes(match.tournament?.format)
    || (match.tournament?.format === 'GROUP_STAGE' && !match.groupKey);
}

function createMatchDomainEvent(event) {
  const EventType = {
    MATCH_STARTED: MatchStartedEvent,
    SCORE_CHANGED: ScoreUpdatedEvent,
    SCORE_SET: ScoreUpdatedEvent,
    FOUL_CARD_ISSUED: FoulCardIssuedEvent,
    MATCH_COMPLETED: MatchCompletedEvent,
  }[event.type];
  return EventType ? new EventType(event) : new MatchEvent(event);
}

function createMatchState(match) {
  return {
    status: match.status,
    score1: match.score1 || 0,
    score2: match.score2 || 0,
    extraTimeScore1: match.extraTimeScore1 || 0,
    extraTimeScore2: match.extraTimeScore2 || 0,
    penaltyScore1: match.penaltyScore1,
    penaltyScore2: match.penaltyScore2,
    period: match.period || '1',
    clockSeconds: match.clockSeconds || 0,
    clockRunning: Boolean(match.clockRunning),
    clockStartedAt: match.clockStartedAt || null,
    winnerId: match.winnerId || null,
  };
}

function activeEventIds(events) {
  const active = new Set();
  const redoStack = [];
  for (const event of events) {
    if (MUTATION_TYPES.has(event.type)) {
      active.add(event.id);
      redoStack.length = 0;
    }
    if (event.type === 'ACTION_UNDONE') {
      active.delete(event.payload.targetEventId);
      redoStack.push(event.payload.targetEventId);
    }
    if (event.type === 'ACTION_REDONE') {
      active.add(event.payload.targetEventId);
      const targetIndex = redoStack.lastIndexOf(event.payload.targetEventId);
      if (targetIndex !== -1) redoStack.splice(targetIndex, 1);
    }
  }
  active.redoStack = redoStack;
  return active;
}

function projectMatch(match, events) {
  const active = activeEventIds(events);
  const firstAction = events.find((event) => MUTATION_TYPES.has(event.type));
  const state = firstAction?.payload?.before
    ? { ...createMatchState(match), ...firstAction.payload.before }
    : createMatchState(match);
  for (const event of events) {
    if (!MUTATION_TYPES.has(event.type) || !active.has(event.id)) continue;
    Object.assign(state, event.payload.after);
  }
  return { ...match, ...state, revision: events.length };
}

function getActionTarget(events, type) {
  const active = activeEventIds(events);
  const reversed = [...events].reverse();
  if (type === 'UNDO') {
    return reversed.find((event) => MUTATION_TYPES.has(event.type) && active.has(event.id));
  }
  const targetId = active.redoStack[active.redoStack.length - 1];
  return reversed.find((event) => event.id === targetId);
}

function decideWinner(match, state) {
  if (state.winnerId) return state.winnerId;
  const scores = [state.score1 + state.extraTimeScore1, state.score2 + state.extraTimeScore2];
  if (scores[0] !== scores[1]) return scores[0] > scores[1] ? match.player1Id : match.player2Id;
  if (state.penaltyScore1 !== null && state.penaltyScore2 !== null
    && state.penaltyScore1 !== state.penaltyScore2) {
    return state.penaltyScore1 > state.penaltyScore2 ? match.player1Id : match.player2Id;
  }
  return null;
}

function calculateStandings(matches, events = []) {
  const standingsByGroup = new Map();
  const getEntry = (group, id, name) => {
    let rows = standingsByGroup.get(group);
    if (!rows) {
      rows = new Map();
      standingsByGroup.set(group, rows);
    }
    if (!rows.has(id)) {
      rows.set(id, {
        participantId: id,
        name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        scored: 0,
        conceded: 0,
        fairPlay: 0,
        headToHead: new Map(),
      });
    }
    return rows.get(id);
  };

  const eventMap = new Map();
  for (const event of events) {
    if (!eventMap.has(event.matchId)) eventMap.set(event.matchId, []);
    eventMap.get(event.matchId).push(event);
  }

  for (const match of matches) {
    if (!match.player1Id || !match.player2Id) continue;
    const state = projectMatch(match, eventMap.get(match.id) || []);
    if (state.status !== 'FINISHED') continue;
    const group = match.groupKey || 'general';
    const first = getEntry(group, match.player1Id, match.player1?.name || match.player1Id);
    const second = getEntry(group, match.player2Id, match.player2?.name || match.player2Id);
    first.played += 1;
    second.played += 1;
    const firstScore = state.score1 + state.extraTimeScore1;
    const secondScore = state.score2 + state.extraTimeScore2;
    first.scored += firstScore;
    first.conceded += secondScore;
    second.scored += secondScore;
    second.conceded += firstScore;
    const winnerId = decideWinner(match, state);
    if (winnerId === match.player1Id) {
      first.wins += 1;
      first.points += 3;
      second.losses += 1;
      first.headToHead.set(second.participantId, (first.headToHead.get(second.participantId) || 0) + 3);
    } else if (winnerId === match.player2Id) {
      second.wins += 1;
      second.points += 3;
      first.losses += 1;
      second.headToHead.set(first.participantId, (second.headToHead.get(first.participantId) || 0) + 3);
    } else {
      first.draws += 1;
      second.draws += 1;
      first.points += 1;
      second.points += 1;
      first.headToHead.set(second.participantId, (first.headToHead.get(second.participantId) || 0) + 1);
      second.headToHead.set(first.participantId, (second.headToHead.get(first.participantId) || 0) + 1);
    }
  }

  const cardPoints = new Map();
  const activeEvents = new Set(events
    .filter((event) => event.matchId && activeEventIds(eventMap.get(event.matchId) || []).has(event.id))
    .map((event) => event.id));
  for (const event of events) {
    if (event.type !== 'FOUL_CARD_ISSUED' || !activeEvents.has(event.id)) continue;
    const playerId = event.payload.playerId;
    cardPoints.set(playerId, (cardPoints.get(playerId) || 0) + (CARD_POINTS[event.payload.cardType] || 1));
  }

  return Object.fromEntries([...standingsByGroup].map(([group, rows]) => {
    const entries = [...rows.values()];
    for (const row of entries) {
      row.difference = row.scored - row.conceded;
      row.fairPlay = cardPoints.get(row.participantId) || 0;
    }
    const tiedOnPrimaryCriteria = new Map();
    for (const entry of entries) {
      const key = `${entry.points}:${entry.difference}`;
      if (!tiedOnPrimaryCriteria.has(key)) tiedOnPrimaryCriteria.set(key, []);
      tiedOnPrimaryCriteria.get(key).push(entry);
    }
    const headToHeadPoints = new Map();
    for (const tiedEntries of tiedOnPrimaryCriteria.values()) {
      for (const entry of tiedEntries) {
        headToHeadPoints.set(entry.participantId, tiedEntries
          .reduce((total, opponent) => total + (entry.headToHead.get(opponent.participantId) || 0), 0));
      }
    }
    entries.sort((first, second) => (
      second.points - first.points
        || second.difference - first.difference
        || (headToHeadPoints.get(second.participantId) || 0) - (headToHeadPoints.get(first.participantId) || 0)
        || second.scored - first.scored
        || first.fairPlay - second.fairPlay
        || first.name.localeCompare(second.name)
    ));
    return [group, entries.map((entry, index) => {
      const { headToHead: _headToHead, ...standing } = entry;
      return { position: index + 1, ...standing };
    })];
  }));
}

module.exports = {
  CARD_POINTS,
  CONTROL_TYPES,
  FoulCardIssuedEvent,
  KnockoutBracketEngine,
  MatchAggregate,
  MatchCompletedEvent,
  MatchEvent,
  MatchPeriod,
  MatchStartedEvent,
  MUTATION_TYPES,
  Score,
  ScoreUpdatedEvent,
  activeEventIds,
  calculateStandings,
  createMatchDomainEvent,
  createMatchState,
  decideWinner,
  getActionTarget,
  projectMatch,
  requiresKnockoutWinner,
};
