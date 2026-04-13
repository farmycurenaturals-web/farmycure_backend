/**
 * CLI: upserts fixed admin users (same as server startup seed).
 * Run: npm run seed:admin (from backend folder)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { seedAdminUsers } = require('../src/config/seedAdminUsers');

async function main() {
  await connectDB({ exitOnFailure: true });
  await seedAdminUsers();
  console.log('Admin users seeded: mdfarmycure, techfarmycure');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
