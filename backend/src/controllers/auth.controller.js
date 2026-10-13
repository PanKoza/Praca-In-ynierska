const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Signs a JWT for the given user payload.
 * @param {{ id: string, role: string }} payload
 * @returns {string} signed JWT
 */
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { name, username, email, password, role? }
 */
async function register(req, res, next) {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'Name, username, email and password are required.' });
    }
    const normalizedUsername = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      return res.status(400).json({ message: 'Username must be 3–24 characters and contain only letters, numbers or underscores.' });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: normalizedUsername }] },
      select: { email: true, username: true },
    });
    if (existingUser?.email === email) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }
    if (existingUser?.username === normalizedUsername) {
      return res.status(409).json({ message: 'This username is already taken.' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        username: normalizedUsername,
        email,
        password: hashedPassword,
        role: ['ORGANIZER', 'REFEREE'].includes(role) ? role : 'PLAYER',
      },
      select: { id: true, name: true, username: true, email: true, role: true, createdAt: true },
    });

    const token = signToken({ id: user.id, role: user.role });

    return res.status(201).json({ token, user });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Email or username is already in use.' });
    }
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Generic message to prevent user enumeration
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = signToken({ id: user.id, role: user.role });

    const { password: _pw, ...userWithoutPassword } = user;
    return res.status(200).json({ token, user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Requires: Authorization: Bearer <token>
 */
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, username: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, getMe };
