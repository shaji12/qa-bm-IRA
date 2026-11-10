const { test, expect } = require('../../../../../core/fixtures/test-fixtures');
const { AdminLoginPage } = require('../../../pages/common/AdminLoginPage');
const { validCredentials, invalidCredentials, messages } = require('../../../data/users');

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Master Admin login', () => {
  test('TC01 — Verify Master Admin login with valid credentials', { tag: ['@sanity'] }, async ({ page, env }) => {
    const admin = env.roles.admin;
    const login = new AdminLoginPage(page, admin.url);

    await login.goto();
    await login.login(admin.username, admin.password);

    await expect(login.institutionDropdown).toBeVisible({ timeout: 30000 });
    await login.selectInstitution('NIMS Corp');

    await expect(login.userMenu).toBeVisible({ timeout: 30000 });
  });

  test('TC02 — Verify validation messages when submitting an empty login form', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.click(login.loginButton);

    await expect(login.emailRequiredError).toBeVisible();
    await expect(login.passwordRequiredError).toBeVisible();
  });

  test('TC03 — Verify login with an invalid email format', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.login(invalidCredentials.badEmailFormat, validCredentials.password);

    await expect(login.emailInput).toHaveAttribute('type', 'email');
    await expect.poll(() =>
      login.emailInput.evaluate((input) => input.validity.typeMismatch)
    ).toBe(true);
    await expect(login.loginButton).toBeVisible();
  });

  test('TC04 — Verify login with an incorrect password', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.login(validCredentials.email, invalidCredentials.wrongPassword);

    await expect(page.getByText(messages.incorrectPassword, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC05 — Verify login with an unregistered email', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);
    const { email, password } = invalidCredentials.unknownEmail;

    await login.goto();
    await login.login(email, password);

    await expect(page.getByText(messages.unknownEmail, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC06 — Verify password show/hide functionality using the eye icon', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.fill(login.passwordInput, validCredentials.password);
    await expect(login.passwordInput).toHaveAttribute('type', 'password');

    await login.togglePasswordVisibility();
    await expect(login.passwordInput).toHaveAttribute('type', 'text');

    await login.togglePasswordVisibility();
    await expect(login.passwordInput).toHaveAttribute('type', 'password');
  });

  test('TC07 — Verify Forgot Password dialog opens successfully', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.openForgotPassword();

    await expect(login.resetDialog).toBeVisible();
    await expect(login.resetEmailInput).toBeVisible();
    await expect(login.sendResetLinkButton).toBeVisible();
  });

  test('TC08 — Verify validation when submitting Send Reset Link with an empty email', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.openForgotPassword();
    await login.requestPasswordReset('');

    await expect(page.getByText(messages.resetEmailRequired)).toBeVisible();
    await expect(login.resetDialog).toBeVisible();
  });

  test('TC09 — Verify closing the Forgot Password dialog', { tag: ['@functional'] }, async ({ page, env }) => {
    const login = new AdminLoginPage(page, env.roles.admin.url);

    await login.goto();
    await login.openForgotPassword();
    await login.closeForgotPassword();

    await expect(login.resetDialog).toBeHidden();
    await expect(login.loginButton).toBeVisible();
  });

  test('TC10 — Verify Cancel action in the logout confirmation dialog', { tag: ['@functional'] }, async ({ page, env }) => {
    const admin = env.roles.admin;
    const login = new AdminLoginPage(page, admin.url);

    await login.goto();
    await login.login(admin.username, admin.password);
    await expect(login.institutionDropdown).toBeVisible({ timeout: 30000 });
    await login.selectInstitution('NIMS Corp');
    await expect(login.userMenu).toBeVisible({ timeout: 30000 });

    await login.cancelLogout();
    await expect(login.userMenu).toBeVisible();
  });

  test('TC11 — Verify successful logout and session termination', { tag: ['@sanity'] }, async ({ page, env }) => {
    const admin = env.roles.admin;
    const login = new AdminLoginPage(page, admin.url);

    await login.goto();
    await login.login(admin.username, admin.password);
    await expect(login.institutionDropdown).toBeVisible({ timeout: 30000 });
    await login.selectInstitution('NIMS Corp');
    await expect(login.userMenu).toBeVisible({ timeout: 30000 });

    await login.logout();
    await expect(login.loginButton).toBeVisible({ timeout: 30000 });
  });
});
