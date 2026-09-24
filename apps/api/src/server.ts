// Server Entry Point
// Defined according to M5.0 Work Package §5

import { buildApiApp } from './app';

const port = Number(process.env.PECP_API_PORT || process.env.PORT || 3001);
const host = process.env.PECP_API_HOST || '0.0.0.0';
const dbPath = process.env.PECP_DB_PATH || 'data/pecp.db';

const app = buildApiApp({
  dbPath,
  logger: true
});

app.listen({ port, host }, (err, address) => {
  if (err) {
    console.error('Failed to start PECP API server:', err);
    process.exit(1);
  }
  console.log(`PECP Governed API running on ${address}`);
});
