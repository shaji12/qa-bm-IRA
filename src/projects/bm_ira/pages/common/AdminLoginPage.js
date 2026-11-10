const { BasePage } = require('../../../../core/base-page');

class AdminLoginPage extends BasePage {
  constructor(page, url) {
    super(page, url);

    this.page = page;
    this.heading = page.getByRole('heading', { name: /login|sign in/i }).first();
    this.emailInput = page.getByRole('textbox', { name: 'Enter Email Address' });
    this.passwordInput = page.getByRole('textbox', { name: 'Enter Password' });
    this.passwordVisibilityToggle = page.locator('button').filter({ has: page.locator('svg') }).first();
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });

    this.emailRequiredError = page.getByText('Email address is required', { exact: true });
    this.passwordRequiredError = page.getByText('Password is required', { exact: true });
    this.invalidEmailError = page.getByText('Please enter a valid email address', { exact: true });

    this.forgotPasswordButton = page.locator('p').filter({ hasText: /^Forgot Password\?$/ });
    this.resetDialog = page.getByText('Forgot Password', { exact: true });
    this.resetEmailInput = page.getByRole('textbox').last();
    this.sendResetLinkButton = page.getByRole('button', { name: 'Submit', exact: true });
    this.closeResetButton = page.getByText('Back to Login', { exact: true });

    this.institutionDropdown = page.getByRole('combobox', { name: 'Institution' });
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });

    this.userMenu = page.getByText('Super Admin').first();
    this.userMenuTrigger = page.getByAltText('User Avatar');
    this.logoutMenuItem = page.getByRole('button', { name: 'Logout', exact: true }).first();
    this.logoutDialog = page.getByRole('dialog', { name: 'Confirm Logout' }).first();
    this.cancelLogoutButton = page.getByRole('button', { name: 'Cancel', exact: true }).first();
    this.confirmLogoutButton = this.logoutDialog.getByRole('button', { name: 'Logout', exact: true });
  }

  async login(email, password) {
    await this.fill(this.emailInput, email);
    await this.fill(this.passwordInput, password);
    await this.click(this.loginButton);
  }

  async togglePasswordVisibility() {
    await this.click(this.passwordVisibilityToggle);
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

  async selectInstitution(name = 'NIMS Corp') {
    await this.click(this.institutionDropdown);
    await this.click(this.page.getByRole('option', { name }).first());
    await this.click(this.continueButton);
  }

  async cancelLogout() {
    await this.click(this.userMenuTrigger);
    await this.click(this.logoutMenuItem);
    await this.waitForVisible(this.logoutDialog);
    await this.click(this.cancelLogoutButton);
  }

  async logout() {
    await this.click(this.userMenuTrigger);
    await this.click(this.logoutMenuItem);
    await this.waitForVisible(this.logoutDialog);
    await this.click(this.confirmLogoutButton);
  }
}

module.exports = { AdminLoginPage };
