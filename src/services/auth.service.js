const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getExpiresIn,
} = require('../utils/jwt');

const SALT_ROUNDS = 12;

function generateClientId() {
  return `client_${crypto.randomBytes(16).toString('hex')}`;
}

function generateClientSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function parseScopes(scopes) {
  return scopes ? scopes.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function toPublicClient(client) {
  const { clientSecretHash, currentRefreshJti, scopes, ...publicClient } = client;
  return { ...publicClient, scopes: parseScopes(scopes) };
}

// Issues a fresh access+refresh pair for a client — used by both login and
// refresh, since refresh is really just "log in again using a refresh
// token instead of a secret." Only the refresh token's jti is tracked
// (currentRefreshJti): the access token stays stateless, so an old one
// keeps working until it naturally expires — see requireAuth's comment for
// why, and JWT_ACCESS_EXPIRES_IN for the exposure window that bounds it.
async function issueTokens(client) {
  const accessToken = signAccessToken(client.id, client.name, parseScopes(client.scopes));
  const refreshJti = crypto.randomUUID();
  const refreshToken = signRefreshToken(client.id, refreshJti);

  await prisma.client.update({
    where: { id: client.id },
    data: { currentRefreshJti: refreshJti },
  });

  return {
    accessToken,
    accessTokenExpiresIn: getExpiresIn(accessToken),
    refreshToken,
    refreshTokenExpiresIn: getExpiresIn(refreshToken),
  };
}

async function register({ name, scopes = [] }) {
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  const clientSecretHash = await bcrypt.hash(clientSecret, SALT_ROUNDS);

  const client = await prisma.client.create({
    data: { name, clientId, clientSecretHash, scopes: scopes.join(',') },
  });

  return { ...toPublicClient(client), clientSecret };
}

async function login({ clientId, clientSecret }) {
  const client = await prisma.client.findUnique({ where: { clientId } });
  if (!client) {
    throw new AppError(401, 'Invalid clientId or clientSecret');
  }

  const matches = await bcrypt.compare(clientSecret, client.clientSecretHash);
  if (!matches) {
    throw new AppError(401, 'Invalid clientId or clientSecret');
  }

  return issueTokens(client);
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const client = await prisma.client.findUnique({ where: { id: payload.sub } });

  // The jti check is what makes the token single-use: it must match the
  // one currently on record, which this same call immediately replaces —
  // so a second attempt with the same (now-old) token is rejected here,
  // whether that's a legitimate double-submit or a replayed stolen token.
  if (!client || !payload.jti || client.currentRefreshJti !== payload.jti) {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  return issueTokens(client);
}

async function getById(id) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    throw new AppError(404, 'Client not found');
  }
  return toPublicClient(client);
}

async function listAll() {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
  return clients.map(toPublicClient);
}

// Invalidates the old secret immediately — the client must switch to the
// new one to log in again. Already-issued access/refresh tokens are
// unaffected until they expire on their own.
async function regenerateSecret(id) {
  const clientSecret = generateClientSecret();
  const clientSecretHash = await bcrypt.hash(clientSecret, SALT_ROUNDS);

  const client = await prisma.client.update({
    where: { id },
    data: { clientSecretHash },
  });

  return { ...toPublicClient(client), clientSecret };
}

async function updateScopes(id, scopes) {
  const client = await prisma.client.update({
    where: { id },
    data: { scopes: scopes.join(',') },
  });

  return toPublicClient(client);
}

module.exports = { register, login, refresh, getById, listAll, regenerateSecret, updateScopes };
