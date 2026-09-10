

const invalidCredentials = {
  wrongPassword: { password: 'definitely-not-the-password' },
  unknownEmail: { email: 'no-such-user@example.com', password: 'whatever123' },
  emptyEmail: { email: '', password: 'whatever123' },
};


const messages = {
  
  loginFailed: 'Login failed.',
  emailRequired: 'Email is required',
  passwordRequired: 'Password is required',
  resetRequested:
    'If an account exists with the provided details, a password reset link has been sent.',
};

/** A real address the reset flow can be pointed at. */
const passwordResetEmail = 'altrin@docme.cloud';

module.exports = { invalidCredentials, messages, passwordResetEmail };
