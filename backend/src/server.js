require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { seedDataIfEmpty } = require('./config/seedData');
const { seedAdminUsers } = require('./config/seedAdminUsers');

/** If Mongo was down at startup, run seeds on first successful API DB connection. */
let deferredSeedNeeded = false;

const ensureMongo = async (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  if (req.path === '/api/health' || req.path === '/api') return next();
  try {
    await connectDB.ensureConnected();
    if (deferredSeedNeeded && connectDB.isConnected()) {
      deferredSeedNeeded = false;
      try {
        await seedDataIfEmpty();
        await seedAdminUsers();
        console.log('Deferred seed OK (Mongo came online).');
      } catch (seedErr) {
        deferredSeedNeeded = true;
        console.error('Deferred seed failed:', seedErr.message);
      }
    }
  } catch (err) {
    return res.status(503).json({
      message: 'Database is not available. Check MONGO_URI and Atlas network access.',
      error: err.message,
    });
  }
  next();
};

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const contactRoutes = require('./routes/contactRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/api', (req, res) => {
  res.json({ message: 'FarmyCure backend running' });
});

app.get('/api/health', async (_req, res) => {
  const { readyState, label } = connectDB.getMongoState();
  let healthy = readyState === 1;
  if (!healthy) {
    try {
      await connectDB.ensureConnected();
      healthy = connectDB.isConnected();
    } catch {
      healthy = false;
    }
  }
  const { readyState: rs, label: lb } = connectDB.getMongoState();
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    server: 'up',
    mongodb: {
      state: lb,
      readyState: rs,
      connected: healthy,
    },
    timestamp: new Date().toISOString(),
  });
});

app.use(ensureMongo);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

app.use((err, _req, res, next) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Image size must be 2MB or smaller' });
  }
  if (String(err.message || '').toLowerCase().includes('only image files are allowed')) {
    return res.status(400).json({ message: 'Only image files are allowed' });
  }
  return res.status(500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB({ exitOnFailure: false });
  } catch (err) {
    console.error('Initial MongoDB connection failed:', err.message);
    console.warn('API will still listen so the admin proxy works; fix MONGO_URI / Atlas, then restart or wait for reconnect.');
  }

  if (connectDB.isConnected()) {
    try {
      await seedDataIfEmpty();
      console.log('Product/category seed OK');
    } catch (err) {
      console.error('Seed failed:', err.message);
    }
    try {
      await seedAdminUsers();
      console.log('Admin users seed OK (mdfarmycure, techfarmycure)');
    } catch (err) {
      console.error('Admin seed failed:', err.message);
    }
    deferredSeedNeeded = false;
  } else {
    deferredSeedNeeded = true;
    console.warn('Skipping seeds until MongoDB is connected (will run on first API request after connect).');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://127.0.0.1:${PORT} (and LAN)`);
  });
}

start().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
