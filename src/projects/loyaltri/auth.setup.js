
const { test: setup, expect } = require('../../core/fixtures/test-fixtures');
const { requireCredentials } = require('../../config/environments');
const { authFile } = require('../../core/constants/paths');
const { LoginPage } = require('./pages/LoginPage');

setup('authenticate as the standard user', async ({ page }) => {
  const env = requireCredentials('loyaltri');
  const loginPage = new LoginPage(page);

  await setup.step('Open the login page', async () => {
    await loginPage.goto();
  });

  await setup.step('Submit valid credentials', async () => {
    await loginPage.login(env.username, env.password);
  });

  await setup.step('Confirm the session is established', async () => {
  
  await expect(loginPage.accountMenu).toBeVisible({ timeout: 30000 });
  });

  await page.context().storageState({ path: authFile('loyaltri') });
});
