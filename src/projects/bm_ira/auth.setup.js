const { test: setup, expect } = require('../../core/fixtures/test-fixtures');
const { requireCredentials } = require('../../config/environments');
const { authFile } = require('../../core/constants/paths');
const { AdminLoginPage } = require('./pages/common/AdminLoginPage');
const { AdminDashboardPage } = require('./pages/common/AdminDashboardPage');

setup('authenticate as the Master Admin', async ({ page }) => {
  const admin = requireCredentials('bm_ira', 'admin');
  const loginPage = new AdminLoginPage(page, admin.url);
  const dashboard = new AdminDashboardPage(page);

  await setup.step('Open the admin login page', async () => {
    await loginPage.goto();
    await page.keyboard.press('Control+0');
  });

  await setup.step('Submit valid credentials', async () => {
    await loginPage.login(admin.username, admin.password);
  });

  await setup.step('Select the parent institution', async () => {
    await expect(loginPage.institutionDropdown).toBeVisible({ timeout: 30000 });
    await loginPage.selectInstitution('NIMS Corp');
  });

  await setup.step('Confirm the session is established', async () => {
    await expect(page.locator('[data-slot="dialog-overlay"]')).toBeHidden({ timeout: 30000 });
    await expect(page.getByText('User Management', { exact: true }).first()).toBeVisible();
  });

  await page.context().storageState({ path: authFile('bm_ira') });
});
