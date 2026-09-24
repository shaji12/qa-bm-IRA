const { test: setup, expect } = require('../../core/fixtures/test-fixtures');
const { requireCredentials } = require('../../config/environments');
const { authFile } = require('../../core/constants/paths');
const { AdminLoginPage } = require('./pages/common/AdminLoginPage');
const { AdminDashboardPage } = require('./pages/common/AdminDashboardPage');

setup('authenticate as the Master Admin', async ({ page }) => {
  const admin = requireCredentials('bm_canteen', 'admin');
  const loginPage = new AdminLoginPage(page, admin.url);
  const dashboard = new AdminDashboardPage(page);

  await setup.step('Open the admin login page', async () => {
    await loginPage.goto();
  });

  await setup.step('Submit valid credentials', async () => {
    await loginPage.login(admin.username, admin.password);
  });

  await setup.step('Confirm the session is established', async () => {
    await expect(dashboard.userMenuButton).toBeVisible({ timeout: 30000 });
  });

  await page.context().storageState({ path: authFile('bm_canteen') });
});
