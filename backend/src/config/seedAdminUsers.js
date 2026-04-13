const bcrypt = require('bcryptjs');
const User = require('../models/User');

/** Fixed admin panel logins (username = stored email field, lowercase). */
const ADMIN_ACCOUNTS = [
  { email: 'mdfarmycure', name: 'MD Farmycure', password: 'mdfarmycure@123', role: 'admin' },
  { email: 'techfarmycure', name: 'Tech Farmycure', password: 'techfarmycure@786', role: 'admin' },
];

/**
 * Ensures the two admin users exist and passwords match the configured values.
 */
const seedAdminUsers = async () => {
  for (const acc of ADMIN_ACCOUNTS) {
    const hashedPassword = await bcrypt.hash(acc.password, 10);
    await User.findOneAndUpdate(
      { email: acc.email },
      {
        $set: {
          name: acc.name,
          password: hashedPassword,
          role: acc.role,
        },
      },
      { upsert: true }
    );
  }
};

module.exports = { seedAdminUsers };
