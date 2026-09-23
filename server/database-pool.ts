import 'dotenv/config';
import { Pool as PostgresPool, type PoolConfig } from 'pg';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';

// Neon Pool carries the PostgreSQL protocol over verified WSS (TLS port 443).
// Unlike one-shot HTTP queries, it retains sessions, transactions and advisory locks.
neonConfig.useSecureWebSocket = true;
neonConfig.poolQueryViaFetch = false;

export function databaseTransport(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required for relational storage.');
  const host = new URL(connectionString).hostname;
  const neon = host.endsWith('.neon.tech');
  const transport = process.env.DATABASE_TRANSPORT || (neon ? 'neon-websocket' : 'postgres');
  if (!['neon-websocket', 'postgres'].includes(transport)) throw new Error('Invalid DATABASE_TRANSPORT.');
  if (transport === 'neon-websocket' && !neon) throw new Error('Neon transport requires a configured Neon host.');
  return transport;
}

export function createDatabasePool(config: PoolConfig = {}): PostgresPool {
  const connectionString = config.connectionString || process.env.DATABASE_URL;
  const options = { connectionTimeoutMillis: 15000, ...config, connectionString };
  if (databaseTransport(connectionString) === 'postgres') return new PostgresPool(options);
  // The official driver implements the pg Pool/Client API used by the existing store.
  // Keep pg types at this boundary so transaction callers remain transport-independent.
  return new NeonPool(options) as unknown as PostgresPool;
}
