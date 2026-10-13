const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class PrismaTournamentWizardRepository {
  createDraft(organizerId, data) {
    return prisma.tournament.create({
      data: {
        title: 'Nowe wydarzenie',
        date: new Date(),
        sportType: 'CUSTOM',
        maxParticipants: 16,
        organizerId,
        wizardData: data,
      },
    });
  }

  findDraft(id, organizerId) {
    return prisma.tournament.findFirst({
      where: { id, organizerId, status: 'DRAFT' },
    });
  }

  updateDraft(id, data, wizardStep) {
    const updated = {
      title: String(data.title || 'Nowe wydarzenie').trim() || 'Nowe wydarzenie',
      description: String(data.description || '').trim() || null,
      ...(data.date && !Number.isNaN(Date.parse(data.date)) && { date: new Date(data.date) }),
      ...(data.endDate && !Number.isNaN(Date.parse(data.endDate)) && { endDate: new Date(data.endDate) }),
      ...(data.registrationDeadline && !Number.isNaN(Date.parse(data.registrationDeadline))
        && { registrationDeadline: new Date(data.registrationDeadline) }),
      ...(data.sportType && { sportType: data.sportType }),
      ...(data.location !== undefined && { location: data.location || null }),
      ...(Number.isInteger(Number(data.maxParticipants)) && { maxParticipants: Number(data.maxParticipants) }),
      ...(data.format && { format: data.format }),
      ...(data.seeding && { seeding: data.seeding }),
      ...(data.registrationType && { registrationType: data.registrationType }),
      ...(data.minTeamSize !== '' && data.minTeamSize !== undefined && { minTeamSize: Number(data.minTeamSize) }),
      ...(data.maxTeamSize !== '' && data.maxTeamSize !== undefined && { maxTeamSize: Number(data.maxTeamSize) }),
      ...(data.entryFee !== '' && data.entryFee !== undefined && { entryFee: Number(data.entryFee) }),
      ...(data.currency !== undefined && { currency: data.currency || null }),
      ...(data.autoApprove !== undefined && { autoApprove: Boolean(data.autoApprove) }),
    };

    return prisma.tournament.update({
      where: { id },
      data: { ...updated, wizardData: data, wizardStep },
    });
  }

  publishDraft(id, organizerId, tournamentData, wizardData) {
    return prisma.tournament.updateMany({
      where: { id, organizerId, status: 'DRAFT' },
      data: { ...tournamentData, wizardData, status: 'PUBLISHED', wizardStep: 4 },
    });
  }

  findPublishedTournament(id, organizerId) {
    return prisma.tournament.findFirst({ where: { id, organizerId } });
  }
}

module.exports = { PrismaTournamentWizardRepository };
