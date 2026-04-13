const mongoose = require('mongoose');

const MONGOOSE_OPTIONS = {
  serverSelectionTimeoutMS: 25_000,
  socketTimeoutMS: 45_000,
  family: 4,
};

let connectInFlight = null;

const getMongoState = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const readyState = mongoose.connection.readyState;
  return { readyState, label: states[readyState] || 'unknown' };
};

const isConnected = () => mongoose.connection.readyState === 1;

/**
 * Connect to MongoDB. Idempotent; safe to call multiple times.
 * @param {{ exitOnFailure?: boolean }} options - if exitOnFailure, process.exit(1) on failure (startup only)
 */
const connectDB = async (options = {}) => {
  const { exitOnFailure = false } = options;
  const uri = process.env.MONGO_URI;

  if (!uri) {
    const msg = 'Missing MONGO_URI in .env';
    console.error(msg);
    if (exitOnFailure) process.exit(1);
    throw new Error(msg);
  }

  if (isConnected()) {
    return;
  }

  if (connectInFlight) {
    await connectInFlight;
    return;
  }

  connectInFlight = (async () => {
    try {
      const conn = await mongoose.connect(uri, MONGOOSE_OPTIONS);
      console.log(`MongoDB Connected: ${conn.connection.host} (db: ${conn.connection.name})`);
    } catch (error) {
      console.error('MongoDB connection failed:', error.message);
      if (String(error.message).includes('ETIMEOUT') || String(error.message).includes('querySrv')) {
        console.error(
          'Hint: Atlas → Network Access: allow your IP or 0.0.0.0/0 (dev). Check VPN/firewall and MONGO_URI (include /dbname before ?).'
        );
      }
      if (exitOnFailure) {
        process.exit(1);
      }
      throw error;
    } finally {
      connectInFlight = null;
    }
  })();

  await connectInFlight;
};

/** Use on requests: reconnect if the driver dropped the connection. */
const ensureConnected = async () => {
  if (isConnected()) return;
  await connectDB({ exitOnFailure: false });
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected — next API call will try to reconnect.');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

connectDB.ensureConnected = ensureConnected;
connectDB.isConnected = isConnected;
connectDB.getMongoState = getMongoState;
module.exports = connectDB;
