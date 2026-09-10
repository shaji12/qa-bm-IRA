
const { test, expect } = require('../../../../../core/fixtures/test-fixtures');
const { LoginPage } = require('../../../pages/LoginPage');
const { DashboardPage } = require('../../../pages/DashboardPage');
const { invalidCredentials, messages, passwordResetEmail } = require('../../../data/users');

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Loyaltri login @smoke', () => {
  test('TC01 — Successful login with valid credentials @LOYTRI-37', async ({ page, env }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await test.step('Open the login page', async () => {
      await login.goto();
      await expect(login.loginHeading).toBeVisible();
    });

    await test.step('Enter valid credentials and sign in', async () => {
      await login.login(env.username, env.password);
    });

    await test.step('The dashboard loads and the session is live', async () => {
      
      await expect(login.accountMenu).toBeVisible({ timeout: 30000 });
      await expect(dashboard.topBar).toBeVisible();
      await expect(dashboard.requestsPanel).toBeVisible();
      await expect(login.signInButton).toBeHidden();
    });
  });

  test('TC02 — Successful login with Remember Me ticked @LOYTRI-38', async ({ page, env }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.loginWithRememberMe(env.username, env.password);

    await expect(login.accountMenu).toBeVisible({ timeout: 30000 });
  });

  test('TC03 — Login succeeds with Remember Me ticked then unticked @LOYTRI-39 @regression', async ({
    page,
    env,
  }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.loginWithoutRememberMe(env.username, env.password);

    await expect(login.accountMenu).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Loyaltri login — invalid input @regression', () => {
  test('TC04 — Login fails with an invalid password @LOYTRI-40', async ({ page, env }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.login(env.username, invalidCredentials.wrongPassword.password);

    
    await expect(login.errorMessage).toHaveText(messages.loginFailed);
    expect(await login.isOnLoginPage()).toBe(true);
  });

  test('TC05 — Login fails for an unknown email @LOYTRI-41', async ({ page }) => {
    const login = new LoginPage(page);
    const { email, password } = invalidCredentials.unknownEmail;

    await login.goto();
    await login.login(email, password);

    await expect(login.errorMessage).toHaveText(messages.loginFailed);
  });

  test('TC06 — Wrong password and unknown email give the same message @LOYTRI-42', async ({
    page,
    env,
  }) => {
   
    const login = new LoginPage(page);

    await login.goto();
    await login.login(env.username, invalidCredentials.wrongPassword.password);
    const wrongPasswordText = await login.errorText();

    await page.reload();
    await login.login(invalidCredentials.unknownEmail.email, 'whatever123');
    const unknownEmailText = await login.errorText();

    expect(unknownEmailText).toBe(wrongPasswordText);
  });

  test('TC07 — Empty form shows both required-field errors @LOYTRI-43', async ({ page }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.submitEmptyForm();

    await expect(login.emailRequiredError).toBeVisible();
    await expect(login.passwordRequiredError).toBeVisible();
    expect(await login.isOnLoginPage()).toBe(true);
  });

  test('TC08 — Email without a password is rejected @LOYTRI-44', async ({ page, env }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.loginWithEmailOnly(env.username);

    await expect(login.passwordRequiredError).toBeVisible();
    await expect(login.emailRequiredError).toBeHidden();
  });

  test('TC09 — Password without an email is rejected @LOYTRI-45', async ({ page, env }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.loginWithPasswordOnly(env.password);

    await expect(login.emailRequiredError).toBeVisible();
    await expect(login.passwordRequiredError).toBeHidden();
  });
});

test.describe('Loyaltri logout', () => {
  test('TC10 — Logout ends the session @LOYTRI-46 @smoke', async ({ page, env }) => {
    const login = new LoginPage(page);

    await test.step('Sign in', async () => {
      await login.goto();
      await login.login(env.username, env.password);
      await expect(login.accountMenu).toBeVisible({ timeout: 30000 });
    });

    await test.step('Sign out and confirm', async () => {
      
      await login.logout();
    });

    await test.step('The login form is back and the session is gone', async () => {
      await expect(login.signInButton).toBeVisible({ timeout: 30000 });
      await expect(login.accountMenu).toBeHidden();
    });
  });

  test('TC11 — Cancelling logout with Not Now keeps the user signed in @LOYTRI-47 @regression', async ({ page, env }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.login(env.username, env.password);
    await expect(login.accountMenu).toBeVisible({ timeout: 30000 });

    await login.cancelLogout();

    await expect(login.accountMenu).toBeVisible();
    await expect(login.signInButton).toBeHidden();
  });

  test('TC12 — Logout dialog offers both choices @LOYTRI-48 @regression', async ({ page, env }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.login(env.username, env.password);
    await expect(login.accountMenu).toBeVisible({ timeout: 30000 });

    await login.openLogoutDialog();

    await expect(login.logoutDialog).toBeVisible();
    await expect(login.confirmLogoutButton).toBeVisible();
    await expect(login.cancelLogoutButton).toBeVisible();
  });
});

test.describe('Loyaltri password reset @regression', () => {
  test('TC13 — Forgot password sends a reset link @LOYTRI-49', async ({ page }) => {
    const login = new LoginPage(page);

    await test.step('Open the reset dialog', async () => {
      await login.goto();
      await login.openForgotPassword();
      await expect(login.forgotPasswordHeading).toBeVisible();
    });

    await test.step('Submit a known address', async () => {
      await login.fill(login.resetEmailInput, passwordResetEmail);
      await login.resetSubmitButton.click();
    });

    await test.step('Confirmation is shown', async () => {
      await expect(login.resetConfirmation).toHaveText(messages.resetRequested);
    });
  });

  test('TC14 — Reset gives the same message for an unknown address @LOYTRI-50', async ({ page }) => {
    
    const login = new LoginPage(page);

    await login.goto();
    await login.requestPasswordReset(invalidCredentials.unknownEmail.email);

    await expect(login.resetConfirmation).toHaveText(messages.resetRequested);
  });

  test('TC15 — Cancel closes the reset dialog without sending @LOYTRI-51', async ({ page }) => {
    const login = new LoginPage(page);

    await login.goto();
    await login.cancelPasswordReset();

    await expect(login.forgotPasswordHeading).toBeHidden();
    await expect(login.signInButton).toBeVisible();
  });
});
