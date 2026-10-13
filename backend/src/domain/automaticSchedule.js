function addDestination(source, outcome, match, slot) {
  if (outcome === 'winner') {
    source.nextMatchId = match.key;
    source.nextSlot = slot;
  } else {
    source.loserNextMatchId = match.key;
    source.loserNextSlot = slot;
  }
}

function linkSource(target, source, outcome, slot) {
  target.sources.push({ key: source.key, outcome });
  addDestination(source, outcome, target, slot);
}

function roundRobinRounds(participants, groupKey = null) {
  const slots = [...participants];
  if (slots.length % 2) slots.push(null);
  const rounds = [];

  for (let round = 0; round < slots.length - 1; round += 1) {
    const matches = [];
    for (let index = 0; index < slots.length / 2; index += 1) {
      const first = slots[index];
      const second = slots[slots.length - 1 - index];
      if (first && second) {
        matches.push({
          key: `group-${groupKey || 'all'}-round-${round + 1}-match-${index + 1}`,
          round: round + 1,
          player1Id: first.id,
          player2Id: second.id,
          groupKey,
          sources: [],
        });
      }
    }
    rounds.push(matches);
    slots.splice(1, 0, slots.pop());
  }
  return rounds;
}

function generateRoundRobin(participants) {
  return {
    format: 'ROUND_ROBIN',
    groups: [],
    rounds: roundRobinRounds(participants),
  };
}

function generateGroupStage(participants) {
  const groupCount = Math.min(4, Math.max(1, Math.floor(participants.length / 4)));
  const groups = Array.from({ length: groupCount }, () => []);
  participants.forEach((participant, index) => groups[index % groupCount].push(participant));

  const rounds = [];
  const maxRounds = Math.max(...groups.map((group) => roundRobinRounds(group).length));
  for (let roundIndex = 0; roundIndex < maxRounds; roundIndex += 1) {
    rounds.push(groups.flatMap((group, groupIndex) => (
      roundRobinRounds(group, `Grupa ${String.fromCharCode(65 + groupIndex)}`)[roundIndex] || []
    )));
  }

  return {
    format: 'GROUP_STAGE',
    groups: groups.map((_, index) => `Grupa ${String.fromCharCode(65 + index)}`),
    rounds,
  };
}

function generateSingleElimination(participants) {
  const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
  const byeCount = bracketSize - participants.length;
  const slots = [];
  for (let index = 0; index < byeCount; index += 1) slots.push(participants[index], null);
  const remainingParticipants = participants.slice(byeCount);
  slots.push(...remainingParticipants);
  const rounds = [];
  let previousRound = null;
  let roundNumber = 1;

  while (slots.length > 1 || previousRound?.length > 1) {
    const matches = [];
    const nextRound = [];
    const matchCount = previousRound ? previousRound.length / 2 : slots.length / 2;
    for (let index = 0; index < matchCount; index += 1) {
      const match = {
        key: `upper-round-${roundNumber}-match-${index + 1}`,
        round: roundNumber,
        player1Id: previousRound ? null : slots[index * 2]?.id || null,
        player2Id: previousRound ? null : slots[index * 2 + 1]?.id || null,
        groupKey: null,
        sources: [],
      };
      matches.push(match);
      nextRound.push(match);
      if (previousRound) {
        linkSource(match, previousRound[index * 2], 'winner', 1);
        linkSource(match, previousRound[index * 2 + 1], 'winner', 2);
      }
    }
    rounds.push(matches);
    if (matchCount === 1) break;
    slots.length = 0;
    previousRound = nextRound;
    roundNumber += 1;
  }
  return { format: 'SINGLE_ELIMINATION', groups: [], rounds };
}

function generateDoubleElimination(participants) {
  const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
  const byeCount = bracketSize - participants.length;
  const slots = [];
  for (let index = 0; index < byeCount; index += 1) slots.push(participants[index], null);
  const remainingParticipants = participants.slice(byeCount);
  slots.push(...remainingParticipants);
  const upperRounds = [];
  let previousRound = null;
  let roundNumber = 1;

  while (true) {
    const matchCount = previousRound ? previousRound.length / 2 : slots.length / 2;
    const matches = Array.from({ length: matchCount }, (_, index) => ({
      key: `upper-round-${roundNumber}-match-${index + 1}`,
      round: roundNumber,
      player1Id: previousRound ? null : slots[index * 2]?.id || null,
      player2Id: previousRound ? null : slots[index * 2 + 1]?.id || null,
      groupKey: null,
      sources: [],
    }));
    if (previousRound) {
      matches.forEach((match, index) => {
        linkSource(match, previousRound[index * 2], 'winner', 1);
        linkSource(match, previousRound[index * 2 + 1], 'winner', 2);
      });
    }
    upperRounds.push(matches);
    if (matchCount === 1) break;
    previousRound = matches;
    roundNumber += 1;
  }

  const lowerRounds = [];
  let previousLowerRound = null;
  if (upperRounds.length === 1) {
    const lowerFinal = {
      key: 'lower-round-1-match-1',
      round: 2,
      player1Id: null,
      player2Id: null,
      groupKey: null,
      sources: [],
    };
    linkSource(lowerFinal, upperRounds[0][0], 'loser', 1);
    lowerRounds.push([lowerFinal]);
    previousLowerRound = [lowerFinal];
  } else {
    const firstUpperRound = upperRounds[0];
    const openingLowerRound = Array.from({ length: firstUpperRound.length / 2 }, (_, index) => ({
      key: `lower-round-${lowerRounds.length + 1}-match-${index + 1}`,
      round: upperRounds.length + lowerRounds.length + 1,
      player1Id: null,
      player2Id: null,
      groupKey: null,
      sources: [],
    }));
    openingLowerRound.forEach((match, index) => {
      linkSource(match, firstUpperRound[index * 2], 'loser', 1);
      linkSource(match, firstUpperRound[index * 2 + 1], 'loser', 2);
    });
    lowerRounds.push(openingLowerRound);
    previousLowerRound = openingLowerRound;

    for (let upperIndex = 1; upperIndex < upperRounds.length; upperIndex += 1) {
      const upperRound = upperRounds[upperIndex];
      const mixRound = Array.from({ length: upperRound.length }, (_, index) => ({
        key: `lower-round-${lowerRounds.length + 1}-match-${index + 1}`,
        round: upperRounds.length + lowerRounds.length + 1,
        player1Id: null,
        player2Id: null,
        groupKey: null,
        sources: [],
      }));
      mixRound.forEach((match, index) => {
        linkSource(match, previousLowerRound[index], 'winner', 1);
        linkSource(match, upperRound[index], 'loser', 2);
      });
      lowerRounds.push(mixRound);
      previousLowerRound = mixRound;

      if (upperIndex < upperRounds.length - 1) {
        const consolidationRound = Array.from({ length: mixRound.length / 2 }, (_, index) => ({
          key: `lower-round-${lowerRounds.length + 1}-match-${index + 1}`,
          round: upperRounds.length + lowerRounds.length + 1,
          player1Id: null,
          player2Id: null,
          groupKey: null,
          sources: [],
        }));
        consolidationRound.forEach((match, index) => {
          linkSource(match, mixRound[index * 2], 'winner', 1);
          linkSource(match, mixRound[index * 2 + 1], 'winner', 2);
        });
        lowerRounds.push(consolidationRound);
        previousLowerRound = consolidationRound;
      }
    }
  }

  const grandFinal = {
    key: 'grand-final',
    round: upperRounds.length + lowerRounds.length + 1,
    player1Id: null,
    player2Id: null,
    groupKey: null,
    sources: [],
  };
  linkSource(grandFinal, upperRounds.at(-1)[0], 'winner', 1);
  if (previousLowerRound?.length === 1) {
    linkSource(grandFinal, previousLowerRound[0], 'winner', 2);
  } else if (!previousLowerRound) {
    throw Object.assign(new Error('Nie można utworzyć dolnej drabinki dla tego formatu.'), { statusCode: 422 });
  }

  return {
    format: 'DOUBLE_ELIMINATION',
    groups: [],
    rounds: [...upperRounds, ...lowerRounds, [grandFinal]],
  };
}

function generateAutomaticSchedule(format, participants) {
  if (!Array.isArray(participants) || participants.length < 2) {
    throw Object.assign(new Error('Co najmniej dwóch zapisanych uczestników jest wymaganych do utworzenia harmonogramu.'), { statusCode: 422 });
  }
  if (participants.length > 256) {
    throw Object.assign(new Error('Automatyczny harmonogram obsługuje maksymalnie 256 uczestników.'), { statusCode: 422 });
  }

  switch (format) {
    case 'ROUND_ROBIN':
      return generateRoundRobin(participants);
    case 'GROUP_STAGE':
      return generateGroupStage(participants);
    case 'SINGLE_ELIMINATION':
      return generateSingleElimination(participants);
    case 'DOUBLE_ELIMINATION':
      if (participants.length < 4) {
        throw Object.assign(new Error('Podwójna eliminacja wymaga co najmniej 4 uczestników.'), { statusCode: 422 });
      }
      if ((participants.length & (participants.length - 1)) !== 0) {
        throw Object.assign(new Error('Pełna drabinka podwójnej eliminacji wymaga liczby uczestników będącej potęgą dwójki.'), { statusCode: 422 });
      }
      return generateDoubleElimination(participants);
    default:
      throw Object.assign(new Error('Nieobsługiwany format wydarzenia.'), { statusCode: 422 });
  }
}

module.exports = { generateAutomaticSchedule };
