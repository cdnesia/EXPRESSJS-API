const mysql = require('mysql2/promise');
const env = require('./env');

const pools = new Map();

function getPool(name) {
  if (pools.has(name)) {
    return pools.get(name);
  }

  const uri = env.databases[name];
  if (!uri) {
    throw new Error(
      `No database registered as "${name}". Add DATABASE_URL_${name} to .env.`
    );
  }

  const pool = mysql.createPool({ uri, waitForConnections: true, connectionLimit: 10 });
  pools.set(name, pool);
  return pool;
}

function registeredDatabaseNames() {
  return Object.keys(env.databases);
}

async function closeAllPools() {
  await Promise.all([...pools.values()].map((pool) => pool.end()));
  pools.clear();
}

module.exports = { getPool, registeredDatabaseNames, closeAllPools };
