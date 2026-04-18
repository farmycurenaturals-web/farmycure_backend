require('dotenv').config();
const dnsSync = require('dns');
const dns = require('dns').promises;
const mongoose = require('mongoose');

const extractMongoHost = (mongoUri = '') => {
  if (!mongoUri) return '';
  if (mongoUri.startsWith('mongodb+srv://')) {
    const stripped = mongoUri.replace('mongodb+srv://', 'http://');
    return new URL(stripped).host;
  }
  if (mongoUri.startsWith('mongodb://')) {
    const stripped = mongoUri.replace('mongodb://', 'http://');
    return new URL(stripped).host.split(',')[0];
  }
  return '';
};

const printHeader = () => {
  console.log('=== FarmyCure DB Preflight ===');
  console.log(`Time: ${new Date().toISOString()}`);
};

const printFailureHints = (error) => {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();

  console.log('\nPossible fixes:');
  if (lower.includes('etimesout') || lower.includes('enotfound') || lower.includes('srv')) {
    console.log('- Check DNS/network access for MongoDB Atlas from this machine.');
    console.log('- Try changing network (mobile hotspot) to rule out ISP/firewall blocks.');
    console.log('- If using mongodb+srv, verify SRV records resolve correctly.');
  }
  if (lower.includes('authentication failed')) {
    console.log('- Verify MongoDB username/password in MONGO_URI.');
  }
  if (lower.includes('ip') || lower.includes('not authorized')) {
    console.log('- In Atlas, allow this machine IP in Network Access.');
  }
  console.log('- Confirm cluster is active and connection string is current.');
};

const configureDnsResolvers = () => {
  const rawServers = process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1';
  const servers = rawServers
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!servers.length) return [];

  try {
    dnsSync.setServers(servers);
    return servers;
  } catch (error) {
    console.error(`Unable to configure DNS resolvers: ${error.message}`);
    return [];
  }
};

const run = async () => {
  printHeader();
  const resolvers = configureDnsResolvers();
  if (resolvers.length) {
    console.log(`DNS resolvers in use: ${resolvers.join(', ')}`);
  }
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('FAIL: MONGO_URI is missing in .env');
    process.exit(1);
  }

  const host = extractMongoHost(mongoUri);
  console.log(`Mongo host: ${host || 'unknown'}`);

  try {
    if (mongoUri.startsWith('mongodb+srv://') && host) {
      const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${host}`);
      console.log(`DNS SRV lookup: OK (${srvRecords.length} record(s))`);
    } else if (host) {
      const address = await dns.lookup(host);
      console.log(`DNS lookup: OK (${address.address})`);
    }
  } catch (error) {
    console.error(`DNS check failed: ${error.message}`);
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log('Mongo connection test: OK');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`Mongo connection test: FAIL (${error.message})`);
    printFailureHints(error);
    process.exit(1);
  }
};

run();
