const mongoose = require('mongoose');
const dns = require('dns');

const configureDnsResolvers = () => {
  const rawServers = process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1';
  const servers = rawServers
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!servers.length) return;

  try {
    dns.setServers(servers);
    console.log(`DNS resolvers in use: ${servers.join(', ')}`);
  } catch (error) {
    console.error(`Failed to set DNS resolvers: ${error.message}`);
  }
};

const connectDB = async () => {
  try {
    configureDnsResolvers();
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
  }
};

module.exports = connectDB;