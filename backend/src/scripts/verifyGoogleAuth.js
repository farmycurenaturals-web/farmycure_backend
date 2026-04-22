require('dotenv').config({ override: true });
const { OAuth2Client } = require('google-auth-library');

const clientId = process.env.GOOGLE_CLIENT_ID;
const idToken = process.argv[2];

if (!clientId) {
  console.error('Missing GOOGLE_CLIENT_ID in backend .env');
  process.exit(1);
}

if (!idToken) {
  console.log('Google auth config looks present.');
  console.log('To verify a real token, run:');
  console.log('npm run verify:google -- <google_id_token>');
  process.exit(0);
}

const client = new OAuth2Client(clientId);

const run = async () => {
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload() || {};
    console.log('Google token verified successfully.');
    console.log(`sub: ${payload.sub || ''}`);
    console.log(`email: ${payload.email || ''}`);
    console.log(`name: ${payload.name || ''}`);
    console.log(`picture: ${payload.picture || ''}`);
    process.exit(0);
  } catch (error) {
    console.error('Google token verification failed.');
    console.error(error.message || String(error));
    process.exit(1);
  }
};

run();
