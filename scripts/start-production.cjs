// Keep npm start in production mode on every platform, including Windows.
process.env.NODE_ENV = 'production';
require('dotenv/config');
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for production startup.');
}
require('../dist/server.cjs');
