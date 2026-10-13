const assert = require('node:assert/strict');
const test = require('node:test');
const { generateAutomaticSchedule } = require('./automaticSchedule');

function participants(count) {
  return Array.from({ length: count }, (_, index) => ({ id: `user-${index + 1}`, name: `Player ${index + 1}` }));
}

function allMatches(schedule) {
  return schedule.rounds.flat();
}

test('round robin schedule plays every pair once across balanced rounds', () => {
  const schedule = generateAutomaticSchedule('ROUND_ROBIN', participants(5));
  const matches = allMatches(schedule);
  const pairs = matches.map(({ player1Id, player2Id }) => [player1Id, player2Id].sort().join(':'));

  assert.equal(matches.length, 10);
  assert.equal(new Set(pairs).size, 10);
  assert.equal(schedule.rounds.length, 5);
  assert.ok(schedule.rounds.every((round) => round.length === 2));
});

test('single elimination creates a connected bracket and advances byes', () => {
  const schedule = generateAutomaticSchedule('SINGLE_ELIMINATION', participants(5));
  const matches = allMatches(schedule);
  const matchesByKey = new Map(matches.map((match) => [match.key, match]));
  const openingByes = schedule.rounds[0].filter((match) => Boolean(match.player1Id) !== Boolean(match.player2Id));

  assert.equal(matches.length, 7);
  assert.equal(schedule.rounds.length, 3);
  assert.equal(openingByes.length, 3);
  for (const match of matches) {
    if (match.nextMatchId) {
      assert.ok(matchesByKey.has(match.nextMatchId));
      assert.ok([1, 2].includes(match.nextSlot));
    }
  }
});

test('group stage distributes participants and schedules every in-group pairing', () => {
  const schedule = generateAutomaticSchedule('GROUP_STAGE', participants(8));
  const matches = allMatches(schedule);
  const pairsByGroup = new Map();
  for (const match of matches) {
    const pairs = pairsByGroup.get(match.groupKey) || new Set();
    pairs.add([match.player1Id, match.player2Id].sort().join(':'));
    pairsByGroup.set(match.groupKey, pairs);
  }

  assert.deepEqual(schedule.groups, ['Grupa A', 'Grupa B']);
  assert.equal(matches.length, 12);
  assert.equal(pairsByGroup.get('Grupa A').size, 6);
  assert.equal(pairsByGroup.get('Grupa B').size, 6);
});

test('double elimination routes winners and losers through to a grand final', () => {
  const schedule = generateAutomaticSchedule('DOUBLE_ELIMINATION', participants(8));
  const matches = allMatches(schedule);
  const matchesByKey = new Map(matches.map((match) => [match.key, match]));
  const grandFinal = matchesByKey.get('grand-final');

  assert.equal(matches.length, 14);
  assert.ok(grandFinal);
  for (const match of matches) {
    if (match.nextMatchId) assert.ok(matchesByKey.has(match.nextMatchId));
    if (match.loserNextMatchId) assert.ok(matchesByKey.has(match.loserNextMatchId));
  }
  assert.equal(matches.filter((match) => match.loserNextMatchId).length, 7);
});

test('double elimination keeps the last upper-bracket loser in the lower final', () => {
  const schedule = generateAutomaticSchedule('DOUBLE_ELIMINATION', participants(4));
  const matches = allMatches(schedule);
  const upperFinal = matches.find((match) => match.key === 'upper-round-2-match-1');
  const lowerFinal = matches.find((match) => match.key.startsWith('lower-') && match.nextMatchId === 'grand-final');

  assert.equal(matches.length, 6);
  assert.equal(upperFinal.loserNextMatchId, lowerFinal.key);
});

test('schedule generation rejects unsupported sizes and formats', () => {
  assert.throws(() => generateAutomaticSchedule('ROUND_ROBIN', participants(1)), /Co najmniej dwóch/);
  assert.throws(() => generateAutomaticSchedule('DOUBLE_ELIMINATION', participants(3)), /co najmniej 4/);
  assert.throws(() => generateAutomaticSchedule('DOUBLE_ELIMINATION', participants(6)), /potęgą dwójki/);
  assert.throws(() => generateAutomaticSchedule('UNKNOWN', participants(4)), /Nieobsługiwany format/);
});
