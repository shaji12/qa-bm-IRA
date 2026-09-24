const { BasePage } = require('../../../../core/base-page');


class AdminLoginPage extends BasePage {
  constructor(page, url) {
    super(page, url);

    this.roleLabel = page.getByText('Master Admin', { exact: true });
    this.heading = page.getByRole('heading', { name: 'Login', level: 1 });
    this.emailInput = page.getByRole('textbox', { name: 'Enter Email Address' });
    this.passwordInput = page.getByRole('textbox', { name: 'Enter Password' });
    this.showPasswordButton = this.passwordInput.locator('..').getByRole('button');
    this.forgotPasswordButton = page.getByRole('button', { name: 'Forgot password?' });
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });

    this.emailRequiredError = page.getByText('Email address is required.');
    this.passwordRequiredError = page.getByText('Password is required.');
    this.invalidEmailError = page.getByText('Enter a valid email address.');

    
    this.toast = page.getByRole('region', { name: /Notifications/ }).getByRole('listitem');

    this.resetDialog = page.getByRole('dialog', { name: 'Forgot Password?' });
    this.resetEmailInput = this.resetDialog.getByRole('textbox', { name: 'Email Address' });
    this.sendResetLinkButton = this.resetDialog.getByRole('button', { name: 'Send Reset Link' });
    this.closeResetButton = this.resetDialog.getByRole('button', { name: 'Close', exact: true });
  }

  async login(email, password) {
    await this.fill(this.emailInput, email);
    await this.fill(this.passwordInput, password);
    await this.click(this.loginButton);
  }

  async togglePasswordVisibility() {
    await this.click(this.showPasswordButton);
  }

  async openForgotPassword() {
    await this.click(this.forgotPasswordButton);
    await this.waitForVisible(this.resetDialog);
  }

  async requestPasswordReset(email) {
    await this.fill(this.resetEmailInput, email);
    await this.click(this.sendResetLinkButton);
  }

  async closeForgotPassword() {
    await this.click(this.closeResetButton);
  }
}

module.exports = { AdminLoginPage };
