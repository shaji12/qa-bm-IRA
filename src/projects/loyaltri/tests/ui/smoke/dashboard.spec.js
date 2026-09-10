
const { test, expect } = require('../../../../../core/fixtures/test-fixtures');
const { DashboardPage } = require('../../../pages/DashboardPage');

test.describe('Loyaltri dashboard @smoke', () => {
  test('Dashboard loads for an authenticated user', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    await dashboard.goto();

   
    await expect(dashboard.topBar).toBeVisible();
    await expect(dashboard.userMenu).toBeVisible();
    await expect(dashboard.requestsPanel).toBeVisible();
    await expect(dashboard.attendancePanel).toBeVisible();
  });
});
