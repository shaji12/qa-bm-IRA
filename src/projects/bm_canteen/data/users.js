
const invalidCredentials = {
  wrongPassword: 'definitely-not-the-password',
  unknownEmail: { email: 'no-such-user@example.com', password: 'whatever123' },
  badEmailFormat: 'not-an-email',
};

const messages = {
  loginFailed: 'Incorrect email or password. Please try again.',
  resetEmailRequired: 'Please enter your email address.',
};

module.exports = { invalidCredentials, messages };
