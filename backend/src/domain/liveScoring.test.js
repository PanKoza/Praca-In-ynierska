const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calculateStandings,
  createMatchState,
  decideWinner,
  getActionTarget,
  projectMatch,
} = require('./liveScoring');

function fixture(overrides = {}) {
  return {
    id: 'match-1',
    status: 'SCHEDULED',
    player1Id: 'team-a',
    player2Id: 'team-b',
    player1: { id: 'team-a', name: 'Drużyna A' },
    player2: { id: 'team-b', name: 'Drużyna B' },
    score1: 0,
    score2: 0,
    extraTimeScore1: 0,
    extraTimeScore2: 0,
    penaltyScore1: null,
    penaltyScore2: null,
    period: '1',
    clockSeconds: 0,
    clockRunning: false,
    clockStartedAt: null,
    ...overrides,
  };
}

function scoreEvent(id, sequence, score1, score2, beforeScore1 = 0) {
  return {
    id,
    sequence,
    type: 'SCORE_CHANGED',
    payload: {
      before: {
        status: 'IN_PROGRESS',
        score1: beforeScore1,
        score2: 0,
        extraTimeScore1: 0,
        extraTimeScore2: 0,
        penaltyScore1: null,
        penaltyScore2: null,
        period: '1',
        clockSeconds: 0,
        clockRunning: false,
        clockStartedAt: null,
        winnerId: null,
      },
      after: { score1, score2, status: 'IN_PROGRESS' },
    },
  };
}

test('match events can be undone and redone without deleting history', () => {
  const match = fixture();
  const events = [
    scoreEvent('event-1', 1, 1, 0),
    scoreEvent('event-2', 2, 2, 0, 1),
    { id: 'undo-1', sequence: 3, type: 'ACTION_UNDONE', payload: { targetEventId: 'event-2' } },
  ];

  assert.equal(projectMatch(match, events).score1, 1);
  assert.equal(getActionTarget(events, 'REDO').id, 'event-2');
  const redone = [...events, { id: 'redo-1', sequence: 4, type: 'ACTION_REDONE', payload: { targetEventId: 'event-2' } }];
  assert.equal(projectMatch(match, redone).score1, 2);
  assert.equal(getActionTarget(redone, 'UNDO').id, 'event-2');
});

test('a new action clears the redo stack and restores its event-derived score', () => {
  const match = fixture();
  const events = [
    scoreEvent('event-1', 1, 1, 0),
    { id: 'undo-1', sequence: 2, type: 'ACTION_UNDONE', payload: { targetEventId: 'event-1' } },
    scoreEvent('event-2', 3, 1, 0),
  ];
  assert.equal(projectMatch(match, events).score1, 1);
  assert.equal(getActionTarget(events, 'REDO'), undefined);
});

test('knockout winner is decided by regulation, extra time, then penalties', () => {
  const match = fixture();
  assert.equal(decideWinner(match, { score1: 2, score2: 1, extraTimeScore1: 0, extraTimeScore2: 0 }), 'team-a');
  assert.equal(decideWinner(match, { score1: 1, score2: 1, extraTimeScore1: 0, extraTimeScore2: 1 }), 'team-b');
  assert.equal(decideWinner(match, { score1: 1, score2: 1, extraTimeScore1: 0, extraTimeScore2: 0, penaltyScore1: 5, penaltyScore2: 4 }), 'team-a');
  assert.equal(decideWinner(match, { score1: 1, score2: 1, extraTimeScore1: 0, extraTimeScore2: 0 }), null);
});

test('a bye is represented as a completed, replayable match event', () => {
  const match = fixture({ player2Id: null, player2: null });
  const before = createMatchState(match);
  const after = { ...before, status: 'FINISHED', winnerId: 'team-a' };
  const projected = projectMatch(match, [{
    id: 'bye-event',
    sequence: 1,
    type: 'BYE_ADVANCED',
    payload: { before, after },
  }]);

  assert.equal(projected.status, 'FINISHED');
  assert.equal(projected.winnerId, 'team-a');
  assert.equal(projected.revision, 1);
});

test('round-robin standings use points, goal difference, head-to-head, goals, and fair play', () => {
  const matches = [
    fixture({ id: 'ab', status: 'FINISHED', score1: 1, score2: 1 }),
    fixture({
      id: 'cd',
      status: 'FINISHED',
      player1Id: 'team-c',
      player2Id: 'team-d',
      player1: { id: 'team-c', name: 'Drużyna C' },
      player2: { id: 'team-d', name: 'Drużyna D' },
      score1: 2,
      score2: 0,
      groupKey: 'Grupa A',
    }),
  ];
  matches[0].groupKey = 'Grupa A';
  const events = [{
    id: 'yellow-card',
    matchId: 'ab',
    sequence: 1,
    type: 'FOUL_CARD_ISSUED',
    payload: { playerId: 'team-a', cardType: 'YELLOW' },
  }];
  const standings = calculateStandings(matches, events)['Grupa A'];
  assert.equal(standings.length, 4);
  assert.equal(standings[0].participantId, 'team-c');
  assert.equal(standings.find((entry) => entry.participantId === 'team-a').fairPlay, 1);
  assert.equal(standings.find((entry) => entry.participantId === 'team-b').fairPlay, 0);
});

test('head-to-head breaks ties after points and goal difference', () => {
  const teams = ['a', 'b', 'c', 'd'];
  const matches = [
    ['a', 'b', 2, 0],
    ['a', 'c', 0, 2],
    ['b', 'c', 2, 0],
    ['c', 'd', 2, 0],
  ].map(([first, second, score1, score2], index) => fixture({
    id: `match-${index}`,
    status: 'FINISHED',
    player1Id: first,
    player2Id: second,
    player1: { id: first, name: first.toUpperCase() },
    player2: { id: second, name: second.toUpperCase() },
    score1,
    score2,
    groupKey: 'Group A',
  }));

  const standings = calculateStandings(matches)['Group A'];
  assert.equal(standings[1].participantId, 'a');
  assert.equal(standings[2].participantId, 'b');
  assert.equal(standings[1].points, standings[2].points);
  assert.equal(standings[1].difference, standings[2].difference);
});
