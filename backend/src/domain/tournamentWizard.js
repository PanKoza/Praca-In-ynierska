const SPORTS = new Set([
  'SOCCER', 'BASKETBALL', 'VOLLEYBALL', 'TENNIS', 'ESPORTS', 'CUSTOM',
  'BEACH_VOLLEYBALL', 'FOOTBALL_6V6', 'OTHER',
]);
const FORMATS = new Set([
  'SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'GROUP_STAGE',
]);
const SEEDING = new Set(['RANDOM', 'MANUAL', 'RANKED']);
const REGISTRATION_TYPES = new Set(['TEAM', 'INDIVIDUAL']);
const CURRENCIES = new Set(['PLN', 'EUR', 'USD', 'GBP']);

class TournamentCreatedEvent {
  constructor(tournamentId, organizerId) {
    this.tournamentId = tournamentId;
    this.organizerId = organizerId;
    this.occurredAt = new Date();
  }
}

class WizardStepCompletedEvent {
  constructor(tournamentId, step, organizerId) {
    this.tournamentId = tournamentId;
    this.step = step;
    this.organizerId = organizerId;
    this.occurredAt = new Date();
  }
}

class SingleEliminationStrategy {
  generate(capacity) {
    return eliminationRounds(capacity, 'single');
  }
}

class DoubleEliminationStrategy {
  generate(capacity) {
    const bracket = eliminationRounds(capacity, 'double');
    bracket.matchCount = Math.max(1, capacity * 2 - 2);
    return bracket;
  }
}

class RoundRobinStrategy {
  generate(capacity) {
    const matches = [];
    for (let first = 1; first <= capacity; first += 1) {
      for (let second = first + 1; second <= capacity; second += 1) {
        matches.push({ round: matches.length + 1, participants: [`Uczestnik ${first}`, `Uczestnik ${second}`] });
      }
    }
    return { format: 'ROUND_ROBIN', rounds: matches.length ? [matches] : [], matchCount: matches.length };
  }
}

class GroupStageToPlayoffStrategy {
  generate(capacity) {
    const groupCount = Math.min(4, Math.max(1, Math.floor(capacity / 4)));
    const groups = Array.from({ length: groupCount }, (_, index) => `Grupa ${String.fromCharCode(65 + index)}`);
    const groupMatches = [];
    for (let first = 1; first <= capacity; first += 1) {
      for (let second = first + 1; second <= capacity; second += 1) {
        if ((first - 1) % groupCount === (second - 1) % groupCount) {
          groupMatches.push({
            round: groupMatches.length + 1,
            participants: [`Uczestnik ${first}`, `Uczestnik ${second}`],
          });
        }
      }
    }
    const playoffSize = Math.min(capacity, groupCount * 2);
    const playoff = eliminationRounds(playoffSize, 'playoffs');
    return {
      format: 'GROUP_STAGE',
      groups,
      rounds: [...(groupMatches.length ? [groupMatches] : []), ...playoff.rounds],
      matchCount: groupMatches.length + playoff.matchCount,
    };
  }
}

const strategies = {
  SINGLE_ELIMINATION: new SingleEliminationStrategy(),
  DOUBLE_ELIMINATION: new DoubleEliminationStrategy(),
  ROUND_ROBIN: new RoundRobinStrategy(),
  GROUP_STAGE: new GroupStageToPlayoffStrategy(),
};

function eliminationRounds(capacity, kind) {
  const rounds = [];
  let participants = Array.from({ length: capacity }, (_, index) => `Uczestnik ${index + 1}`);
  let round = 1;
  let byeCount = 0;
  while (participants.length > 1) {
    const matches = [];
    const advancing = [];
    for (let match = 0; match < participants.length - 1; match += 2) {
      const matchNumber = matches.length + 1;
      matches.push({
        round,
        participants: [participants[match], participants[match + 1]],
      });
      advancing.push(`Zwycięzca meczu ${round}.${matchNumber}`);
    }
    if (participants.length % 2) {
      advancing.push(participants[participants.length - 1]);
      byeCount += 1;
    }
    rounds.push(matches);
    participants = advancing;
    round += 1;
  }
  const baseMatchCount = rounds.reduce((total, current) => total + current.length, 0);
  return {
    format: kind === 'playoffs' ? 'PLAYOFFS' : `${kind.toUpperCase()}_ELIMINATION`,
    rounds,
    matchCount: baseMatchCount,
    byeCount,
  };
}

function validateStep(step, data) {
  const errors = {};
  const add = (field, message) => { errors[field] = message; };

  if (step >= 1) {
    if (!String(data.title || '').trim()) add('title', 'Podaj nazwę wydarzenia.');
    if (String(data.title || '').trim().length > 120) add('title', 'Nazwa może mieć maksymalnie 120 znaków.');
    if (!SPORTS.has(data.sportType)) add('sportType', 'Wybierz prawidłową dyscyplinę.');
    if (!data.date || Number.isNaN(Date.parse(data.date))) add('date', 'Podaj prawidłową datę rozpoczęcia.');
    if (data.endDate && (Number.isNaN(Date.parse(data.endDate)) || Date.parse(data.endDate) < Date.parse(data.date))) {
      add('endDate', 'Data zakończenia nie może być wcześniejsza niż rozpoczęcie.');
    }
    if (data.registrationDeadline && (Number.isNaN(Date.parse(data.registrationDeadline))
      || Date.parse(data.registrationDeadline) > Date.parse(data.date))) {
      add('registrationDeadline', 'Termin zapisów musi przypadać przed rozpoczęciem wydarzenia.');
    }
    if (!String(data.location || '').trim()) add('location', 'Podaj lokalizację wydarzenia.');
  }

  if (step >= 2) {
    if (!FORMATS.has(data.format)) add('format', 'Wybierz format rozgrywek.');
    if (!Number.isInteger(Number(data.maxParticipants)) || Number(data.maxParticipants) < 2 || Number(data.maxParticipants) > 256) {
      add('maxParticipants', 'Limit uczestników musi wynosić od 2 do 256.');
    }
    if (!data.allowByes && Number.isInteger(Number(data.maxParticipants))
      && (Number(data.maxParticipants) & (Number(data.maxParticipants) - 1)) !== 0) {
      add('maxParticipants', 'Bez wolnych losów wybierz limit będący potęgą dwójki.');
    }
    if (!SEEDING.has(data.seeding)) add('seeding', 'Wybierz sposób rozstawienia.');
  }

  if (step >= 3) {
    if (!REGISTRATION_TYPES.has(data.registrationType)) add('registrationType', 'Wybierz typ zgłoszenia.');
    if (data.registrationType === 'TEAM') {
      const min = Number(data.minTeamSize);
      const max = Number(data.maxTeamSize);
      if (!Number.isInteger(min) || min < 1) add('minTeamSize', 'Minimalny skład musi wynosić co najmniej 1.');
      if (!Number.isInteger(max) || max < min) add('maxTeamSize', 'Maksymalny skład nie może być mniejszy od minimalnego.');
    }
    if (data.entryFee !== '' && data.entryFee !== null && data.entryFee !== undefined
      && (!Number.isFinite(Number(data.entryFee)) || Number(data.entryFee) < 0)) {
      add('entryFee', 'Opłata musi być nieujemną kwotą.');
    }
    if (data.entryFee && !CURRENCIES.has(data.currency)) add('currency', 'Wybierz obsługiwaną walutę.');
  }

  return errors;
}

function validateDraft(data) {
  return validateStep(3, data);
}

function assertStepTransition(currentStep, nextStep, data, fromStep = currentStep) {
  if (!Number.isInteger(nextStep) || nextStep < 1 || nextStep > 4) {
    throw Object.assign(new Error('Nieprawidłowy krok kreatora.'), { statusCode: 400 });
  }
  if (!Number.isInteger(fromStep) || fromStep < 1 || fromStep > 4 || fromStep > currentStep) {
    throw Object.assign(new Error('Nieprawidłowy stan kreatora.'), { statusCode: 400 });
  }
  if (nextStep > fromStep + 1) {
    throw Object.assign(new Error('Nie można pominąć kroku kreatora.'), { statusCode: 409 });
  }
  if (nextStep > fromStep) {
    const errors = validateStep(fromStep, data);
    if (Object.keys(errors).length) {
      throw Object.assign(new Error('Popraw błędy bieżącego kroku przed kontynuowaniem.'), {
        statusCode: 422,
        details: errors,
      });
    }
  }
}

function getStructurePreview(format, capacity) {
  const strategy = strategies[format];
  if (!strategy) throw Object.assign(new Error('Nieobsługiwany format rozgrywek.'), { statusCode: 400 });
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 256) {
    throw Object.assign(new Error('Limit uczestników musi wynosić od 2 do 256.'), { statusCode: 400 });
  }
  return strategy.generate(capacity);
}

class TournamentBuilder {
  constructor(data) {
    this.data = data;
    this.tournament = {};
  }

  withBasicInfo() {
    const { data } = this;
    Object.assign(this.tournament, {
      title: String(data.title).trim(),
      description: String(data.description || '').trim() || null,
      date: new Date(data.date),
      endDate: data.endDate ? new Date(data.endDate) : null,
      registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
      sportType: data.sportType,
      location: String(data.location).trim(),
      maxParticipants: Number(data.maxParticipants),
    });
    return this;
  }

  withFormat() {
    Object.assign(this.tournament, {
      format: this.data.format,
      seeding: this.data.seeding,
    });
    return this;
  }

  withRegistrationRules() {
    const { data } = this;
    Object.assign(this.tournament, {
      registrationType: data.registrationType,
      minTeamSize: data.registrationType === 'TEAM' ? Number(data.minTeamSize) : null,
      maxTeamSize: data.registrationType === 'TEAM' ? Number(data.maxTeamSize) : null,
      entryFee: data.entryFee === '' || data.entryFee === null ? null : Number(data.entryFee),
      currency: data.entryFee ? data.currency : null,
      autoApprove: Boolean(data.autoApprove),
    });
    return this;
  }

  build() {
    return { ...this.tournament };
  }
}

function buildTournament(data) {
  const errors = validateDraft(data);
  if (Object.keys(errors).length) {
    throw Object.assign(new Error('Uzupełnij poprawnie wszystkie kroki kreatora.'), {
      statusCode: 422,
      details: errors,
    });
  }
  return new TournamentBuilder(data)
    .withBasicInfo()
    .withFormat()
    .withRegistrationRules()
    .build();
}

module.exports = {
  assertStepTransition,
  buildTournament,
  getStructurePreview,
  TournamentCreatedEvent,
  TournamentBuilder,
  validateDraft,
  validateStep,
  WizardStepCompletedEvent,
};
