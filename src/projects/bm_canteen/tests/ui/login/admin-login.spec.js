const { test, expect } = require('../../../../../core/fixtures/test-fixtures');
const { AdminLoginPage } = require('../../../pages/common/AdminLoginPage');
const { AdminDashboardPage } = require('../../../pages/common/AdminDashboardPage');
const { invalidCredentials, messages } = require('../../../data/users');

test.use({ storageState: { cookies: [], origins: [] } });



test.describe('Master Admin login', () => {
  test('TC01 — Master Admin logs in with valid credentials @Canteen-52', { tag: ['@sanity'] }, async ({ page, env }) => {
    const admin = env.roles.admin;
    const login = new AdminLoginPage(page, admin.url);
    const dashboard = new AdminDashboardPage(page);

    await test.step('Open the admin login page', async () => {
      await login.goto();
      await expect(login.roleLabel).toBeVisible();
      await expect(login.heading).toBeVisible();
    });

    await test.step('Enter a valid email and password', async () => {
      await login.fill(login.emailInput, admin.username);
      await login.fill(login.passwordInput, admin.password);
      await expect(login.passwordInput).toHaveAttribute('type', 'password');
    });

    await test.step('Click Login', async () => {
      await login.click(login.loginButton);
    });

    await test.step('The Master Admin dashboard loads', async () => {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
      await expect(dashboard.heading).toBeVisible();
      await expect(dashboard.userMenuButton).toBeVisible();
    });
  });
});

test.describe('Master Admin login — invalid input', () => {
  test('TC02 — Empty form shows both required-field errors @Canteen-53', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.click(login.loginButton);

    await expect(login.emailRequiredError).toBeVisible();
    await expect(login.passwordRequiredError).toBeVisible();
    await expect(login.loginButton).toBeVisible();
  });

  test('TC03 — Email in the wrong format is rejected @Canteen-54', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.login(invalidCredentials.badEmailFormat, invalidCredentials.unknownEmail.password);

    await expect(login.invalidEmailError).toBeVisible();
    await expect(login.loginButton).toBeVisible();
  });

  test('TC04 — Login fails with a wrong password @Canteen-55', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.login(env.roles.admin.username, invalidCredentials.wrongPassword);

    await expect(login.toast).toContainText(messages.loginFailed);
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC05 — Login fails for an unknown email with the same message @Canteen-56', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);
    const { email, password } = invalidCredentials.unknownEmail;

    await login.goto();
    await login.login(email, password);

    await expect(login.toast).toContainText(messages.loginFailed);
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC06 — Eye icon shows and hides the password @Canteen-57', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.fill(login.passwordInput, invalidCredentials.wrongPassword);
    await expect(login.passwordInput).toHaveAttribute('type', 'password');

    await login.togglePasswordVisibility();
    await expect(login.passwordInput).toHaveAttribute('type', 'text');

    await login.togglePasswordVisibility();
    await expect(login.passwordInput).toHaveAttribute('type', 'password');
  });
});

test.describe('Master Admin forgot password', () => {
  test('TC07 — Forgot password opens the reset dialog @Canteen-58', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.openForgotPassword();

    await expect(login.resetEmailInput).toBeVisible();
    await expect(login.sendResetLinkButton).toBeVisible();
    await expect(login.closeResetButton).toBeVisible();
  });

  test('TC08 — Send Reset Link with no email is rejected @Canteen-59', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.openForgotPassword();
    await login.requestPasswordReset('');

    await expect(login.toast).toContainText(messages.resetEmailRequired);
    await expect(login.resetDialog).toBeVisible();
  });

  test('TC09 — Close dismisses the reset dialog @Canteen-60', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.openForgotPassword();
    await login.closeForgotPassword();

    await expect(login.resetDialog).toBeHidden();
    await expect(login.loginButton).toBeVisible();
  });
});

test.describe('Master Admin logout', () => {
  test('TC10 — Cancel on the logout dialog keeps the admin signed in @Canteen-61', { tag: ['@functional'] }, async ({ page, env }) => {
    const admin = env.roles.admin;
    const login = new AdminLoginPage(page, admin.url);
    const dashboard = new AdminDashboardPage(page);

    await login.goto();
    await login.login(admin.username, admin.password);
    await expect(dashboard.userMenuButton).toBeVisible({ timeout: 30000 });

    await dashboard.cancelLogout();

    await expect(dashboard.logoutDialog).toBeHidden();
    await expect(dashboard.userMenuButton).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('TC11 — Logout ends the session @Canteen-62', { tag: ['@sanity'] }, async ({ page, env }) => {
    const admin = env.roles.admin;
    const login = new AdminLoginPage(page, admin.url);
    const dashboard = new AdminDashboardPage(page);

    await test.step('Sign in', async () => {
      await login.goto();
      await login.login(admin.username, admin.password);
      await expect(dashboard.userMenuButton).toBeVisible({ timeout: 30000 });
    });

  
    await test.step('Log out and confirm', async () => {
      await dashboard.logout();
      await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
      await expect(login.loginButton).toBeVisible();
    });

    await test.step('Reopening the admin page asks for credentials again', async () => {
      await login.goto();
      await expect(login.loginButton).toBeVisible();
      await expect(dashboard.userMenuButton).toBeHidden();
    });
  });
});
