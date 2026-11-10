const validCredentials = {
  email: 'super.admin@docme.com',
  password: 'One@123',
};

const invalidCredentials = {
  wrongPassword: 'definitely-not-the-password',
  unknownEmail: { email: 'no-such-user@example.com', password: 'whatever123' },
  badEmailFormat: 'not-an-email',
};

const messages = {
  incorrectPassword: 'Please check your password',
  unknownEmail: 'Please check your email or contact support.',
  resetEmailRequired: 'Email is required',
  emailRequired: 'Email address is required',
  passwordRequired: 'Password is required',
};

module.exports = {
  validCredentials,
  invalidCredentials,
  messages,
};
