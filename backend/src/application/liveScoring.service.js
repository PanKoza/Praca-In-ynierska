const crypto = require('node:crypto');
const { PrismaLiveScoringRepository } = require('../infrastructure/prismaLiveScoring.repository');
const eventBus = require('../infrastructure/matchEventBus');

const repository = new PrismaLiveScoringRepository();

class LiveScoringService {
  async execute(matchId, actorId, command) {
    if (typeof command.commandId !== 'string' || command.commandId.length > 100) {
      throw Object.assign(new Error('Nieprawidłowy identyfikator komendy.'), { statusCode: 400 });
    }
    if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
      throw Object.assign(new Error('Wymagana jest aktualna wersja meczu.'), { statusCode: 400 });
    }
    const result = await repository.appendCommand({ id: matchId, actorId, command });
    if (result.publishedEvent) {
      eventBus.publish(result.tournament.id, {
        type: 'MATCH_UPDATED',
        matchId,
        revision: result.revision,
        match: publicMatch(result),
      });
    }
    return result;
  }

  issueRefereeAccess(matchId, organizerId, role) {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return repository.issueRefereeAccess(matchId, organizerId, tokenHash, role)
      .then((match) => ({
        accessUrl: `/referee/${matchId}?access=${encodeURIComponent(token)}`,
        expiresAt: match.refereeTokenExpiresAt?.toISOString(),
      }));
  }

  assignReferee(matchId, username, organizerId, role) {
    return repository.assignReferee(matchId, username, organizerId, role);
  }

  unassignReferee(matchId, organizerId, role) {
    return repository.unassignReferee(matchId, organizerId, role);
  }

  revokeRefereeAccess(matchId, organizerId, role) {
    return repository.revokeRefereeAccess(matchId, organizerId, role);
  }

  getLiveMatch(matchId) {
    return repository.getLiveMatch(matchId);
  }

  getAssignedRefereeMatches(refereeId) {
    return repository.getAssignedRefereeMatches(refereeId);
  }

  getStandings(tournamentId) {
    return repository.getTournamentStandings(tournamentId);
  }
}

function publicMatch(match, includeEventHistory = false) {
  const {
    refereeTokenHash,
    refereeTokenExpiresAt,
    eventHistory,
    tournament,
    ...safe
  } = match;
  return {
    ...safe,
    ...(tournament && { tournament: { id: tournament.id, title: tournament.title, format: tournament.format } }),
    ...(includeEventHistory && { eventHistory }),
  };
}

module.exports = { LiveScoringService, publicMatch };
