const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
const deriveCallbackUrl = () => {
  const explicit = String(process.env.GOOGLE_CALLBACK_URL || process.env.GOOGLE_REDIRECT_URI || '').trim();
  if (explicit) return explicit;
  const baseUrl = String(process.env.BASE_URL || '').trim().replace(/\/+$/, '');
  if (baseUrl) return `${baseUrl}/api/auth/google/callback`;
  return '/api/auth/google/callback';
};
const GOOGLE_CALLBACK_URL = deriveCallbackUrl();
const hasGoogleOauthConfig = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

const findOrCreateGoogleUser = async ({ email, name, picture, googleId }) => {
  let user = await User.findOne({ email });

  if (!user) {
    const randomPassword = await bcrypt.hash(`${googleId}_${Date.now()}`, 10);
    user = await User.create({
      name: name || email.split('@')[0],
      email,
      password: randomPassword,
      profileImage: picture || '',
      googleId,
    });
    return user;
  }

  let shouldSave = false;
  if (!user.googleId) {
    user.googleId = googleId;
    shouldSave = true;
  }
  if (picture && !user.profileImage) {
    user.profileImage = picture;
    shouldSave = true;
  }
  if (name && !user.name) {
    user.name = name;
    shouldSave = true;
  }
  if (shouldSave) {
    await user.save();
  }

  return user;
};

if (hasGoogleOauthConfig) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = String(profile?.emails?.[0]?.value || '')
            .trim()
            .toLowerCase();
          const googleId = String(profile?.id || '').trim();
          const picture = String(profile?.photos?.[0]?.value || '').trim();
          const name = String(profile?.displayName || '').trim();

          if (!email || !googleId) {
            return done(new Error('Google profile is missing required fields'));
          }

          const user = await findOrCreateGoogleUser({ email, name, picture, googleId });
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
} else {
  console.warn('Google OAuth disabled: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user || null);
  } catch (error) {
    done(error);
  }
});

module.exports = { passport, hasGoogleOauthConfig };
