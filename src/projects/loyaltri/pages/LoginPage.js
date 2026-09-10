const { BasePage } = require('../../../core/base-page');


class LoginPage extends BasePage {
 
  constructor(page) {
   
    super(page, '/');

    
    this.emailInput = page.getByRole('textbox', { name: 'Email Address' });
    this.passwordInput = page.getByRole('textbox', { name: 'Enter your password' });
    this.rememberMeCheckbox = page.getByRole('checkbox', { name: 'Remember Me' });
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    this.forgotPasswordLink = page.getByText('Forgot password?');
    this.loginHeading = page.getByText('Welcome back');
    this.errorMessage = page.getByText('Login failed.');

    
    this.emailRequiredError = page.getByText('Email is required');
    this.passwordRequiredError = page.getByText('Password is required');

   
    this.accountMenu = page
      .locator('a')
      .filter({ hasText: /[\w.+-]+@[\w-]+\.[\w.]+/ })
      .first();

    this.logoutButton = page.getByRole('button', { name: 'Log Out' });
    this.logoutDialog = page.getByRole('dialog');
    this.confirmLogoutButton = page.getByRole('button', { name: 'Logout Now' });
    this.cancelLogoutButton = page.getByRole('button', { name: 'Not Now' });

   
    this.sidebar = page.getByRole('complementary');

    
    this.forgotPasswordHeading = page.getByText('Forgot Password', { exact: true });
    this.resetEmailInput = page.getByRole('textbox', { name: 'Enter Email' });
    this.resetSubmitButton = page.getByRole('button', { name: 'Submit' });
    this.resetCancelButton = page.getByRole('button', { name: 'Cancel' });
    this.resetConfirmation = page.getByText(/if an account exists with the provided details/i);
  }

  
  async fillCredentials(email, password) {
    await this.fill(this.emailInput, email);
    await this.fill(this.passwordInput, password);
  }

  async setRememberMe(shouldRemember) {
    await this.waitForVisible(this.rememberMeCheckbox);
    if (shouldRemember) {
      await this.rememberMeCheckbox.check();
    } else {
      await this.rememberMeCheckbox.uncheck();
    }
  }

  async submit() {
    await this.click(this.signInButton);
  }

 
  async login(email, password) {
    await this.fillCredentials(email, password);
    await this.submit();
  }

 
  async loginWithRememberMe(email, password) {
    await this.fillCredentials(email, password);
    await this.setRememberMe(true);
    await this.submit();
  }


  async loginWithoutRememberMe(email, password) {
    await this.fillCredentials(email, password);
    await this.setRememberMe(true);
    await this.setRememberMe(false);
    await this.submit();
  }


  async loginWithEmailOnly(email) {
    await this.fill(this.emailInput, email);
    await this.fill(this.passwordInput, '');
    await this.submit();
  }


  async loginWithPasswordOnly(password) {
    await this.fill(this.emailInput, '');
    await this.fill(this.passwordInput, password);
    await this.submit();
  }

  
  async submitEmptyForm() {
    await this.fill(this.emailInput, '');
    await this.fill(this.passwordInput, '');
    await this.submit();
  }

  
  async errorText() {
    return this.textOf(this.errorMessage);
  }

  /** True while the sign-in form is still on screen. */
  async isOnLoginPage() {
    return this.isVisible(this.signInButton);
  }

  /**
   * Open the top-bar account menu.
   * @param {string} [email] narrows to a specific user's link
   */
  async openAccountMenu(email) {
    const menu = email
      ? this.page.locator('a').filter({ hasText: email }).first()
      : this.accountMenu;
    await this.click(menu);
  }

  
  async logout(email) {
    await this.openAccountMenu(email);
    await this.click(this.logoutButton);
    await this.click(this.confirmLogoutButton);
  }

  
  async cancelLogout(email) {
    await this.openAccountMenu(email);
    await this.click(this.logoutButton);
    await this.click(this.cancelLogoutButton);
  }

  /** Open the logout confirmation without answering it. */
  async openLogoutDialog(email) {
    await this.openAccountMenu(email);
    await this.click(this.logoutButton);
  }


  /** Follow the "Forgot password?" link from the login page. */
  async openForgotPassword() {
    await this.click(this.forgotPasswordLink);
  }

  /**
   * Request a reset link, starting from the login page.
   *
   * Loyaltri returns the same "if an account exists" message for known and
   * unknown addresses — deliberate, so the form cannot be used to discover
   * which emails are registered.
   */
  async requestPasswordReset(email) {
    await this.openForgotPassword();
    await this.fill(this.resetEmailInput, email);
    await this.click(this.resetSubmitButton);
  }

  /** Open the reset dialog and dismiss it with Cancel, changing nothing. */
  async cancelPasswordReset() {
    await this.openForgotPassword();
    await this.click(this.resetCancelButton);
  }
}

module.exports = { LoginPage };
