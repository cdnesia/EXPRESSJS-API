require('dotenv').config();

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Any DATABASE_URL_<NAME> in .env becomes an extra named database
// connection (e.g. DATABASE_URL_LOGS -> databases.LOGS), on top of the
// required main DATABASE_URL. Adding a new database is then just adding
// one line to .env — no code changes needed to register it.
const extraDatabases = {};
for (const [key, value] of Object.entries(process.env)) {
  const match = key.match(/^DATABASE_URL_(.+)$/);
  if (match && value) {
    extraDatabases[match[1]] = value;
  }
}

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: required('DATABASE_URL'),
  databases: extraDatabases,
  // Comma-separated whitelist so multiple client apps (web, mobile, etc.)
  // can each be allowed explicitly instead of falling back to "*".
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  // Not required() at startup so the app still boots before the bot is
  // configured — telegram.service throws only when send-message is actually called.
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID,
    apiUrl: process.env.TELEGRAM_API_URL || 'https://api.telegram.org',
  },
};
