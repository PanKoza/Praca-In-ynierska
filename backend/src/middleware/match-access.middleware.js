const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function matchAccess(req, res, next) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: { tournament: { select: { organizerId: true } } },
    });
    if (!match) return res.status(404).json({ message: 'Nie znaleziono meczu.' });

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token && req.user?.role !== 'REFEREE') {
      const digest = crypto.createHash('sha256').update(token).digest('hex');
      const stored = match.refereeTokenHash || '';
      const validToken = stored.length === digest.length
        && crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(digest))
        && match.refereeTokenExpiresAt
        && match.refereeTokenExpiresAt > new Date();
      if (validToken) {
        req.matchActor = { id: null, type: 'REFEREE' };
        req.matchRecord = match;
        return next();
      }
    }

    if (req.user && (req.user.id === match.tournament.organizerId
      || req.user.role === 'ADMIN'
      || (req.user.role === 'REFEREE' && req.user.id === match.assignedRefereeId))) {
      req.matchActor = {
        id: req.user.id,
        type: req.user.role === 'REFEREE' ? 'REFEREE' : 'ORGANIZER',
      };
      req.matchRecord = match;
      return next();
    }
    return res.status(403).json({ message: 'Brak dostępu do tego meczu.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { matchAccess };
