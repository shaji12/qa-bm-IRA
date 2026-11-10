const { test, expect } = require('../../../../../core/fixtures/test-fixtures');
const { AdminDashboardPage } = require('../../../pages/common/AdminDashboardPage');
const { AdminLoginPage } = require('../../../pages/common/AdminLoginPage');
const { UserManagementPage } = require('../../../pages/common/sidemenu/User Management/UserManagementPage');
const { userTableHeadersExpected, userManagementData, createUser } = require('../../../data/user-management');

async function openUserManagement(page) {
  const dashboard = new AdminDashboardPage(page);
  const login = new AdminLoginPage(page);
  const users = new UserManagementPage(page);

  await dashboard.goto();
  if (await login.institutionDropdown.isVisible()) {
    await login.selectInstitution('NIMS Corp');
  }
  await expect(page.locator('[data-slot="dialog-overlay"]')).toBeHidden({ timeout: 30000 });
  await users.navigateToUserManagement();
  return users;
}

test.describe('User Management', () => {
  test('UM01 — Super Admin can access User Management', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);

    await expect(users.newUserButton).toBeVisible();
  });

  test('UM02 — User Management displays user details and table columns', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);

    const headerTexts = (await users.headers.allInnerTexts()).map((header) => header.trim());
    expect(headerTexts).toEqual(expect.arrayContaining(userTableHeadersExpected));
    await expect(users.rows.first()).toBeVisible();
    const details = await users.firstUserDetails();
    for (const value of Object.values(details)) {
      expect(value).not.toBe('');
    }
  });

  test('UM03 — Users can be searched by name, email, and institution', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const details = await users.firstUserDetails();

    for (const value of [details.name, details.email, details.institution]) {
      await users.search(value);
      await expect(users.rows.filter({ hasText: value }).first()).toBeVisible();
    }
  });

  test('UM04 — User records can be sorted', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const nameHeader = users.headers.filter({ hasText: /name|user/i }).first();

    await nameHeader.click();
    const firstOrder = await users.rows.allInnerTexts();
    await nameHeader.click();
    await expect.poll(async () => users.rows.allInnerTexts()).not.toEqual(firstOrder);
    const secondOrder = await users.rows.allInnerTexts();

    expect(firstOrder.length).toBeGreaterThan(1);
    expect(secondOrder).not.toEqual(firstOrder);
  });

  test('UM05 — Users can be filtered by institution', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const details = await users.firstUserDetails();

    await users.selectFilter('Institution', details.institution);
    expect(await users.rows.count()).toBeGreaterThan(0);
    for (const row of await users.rows.all()) {
      await expect(row).toContainText(details.institution);
    }
  });

  test('UM06 — Users can be filtered by role', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const details = await users.firstUserDetails();

    await users.selectFilter('Role', details.role);
    expect(await users.rows.count()).toBeGreaterThan(0);
    for (const row of await users.rows.all()) {
      await expect(row).toContainText(details.role);
    }
  });

  test('UM07 — Users can be filtered by active and inactive status', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    await users.selectFilter('Status', 'Active');
    expect(await users.rows.count()).toBeGreaterThan(0);
    for (const row of await users.rows.all()) {
      await expect(row).toContainText(/active/i);
    }
    await users.selectFilter('Status', 'Inactive');
    expect(await users.rows.count()).toBeGreaterThan(0);
    for (const row of await users.rows.all()) {
      await expect(row).toContainText(/inactive/i);
    }
  });

  test('UM08 — New User opens the Add User form', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);

    await users.openAddUserForm();
    await expect(users.form).toBeVisible();
    await expect(users.saveButton).toBeVisible();
  });

  test('UM09 — Add User validates mandatory fields', { tag: ['@functional', '@no-prod'] }, async ({ page }) => {
    const users = await openUserManagement(page);

    await users.openAddUserForm();
    await users.submitUserForm();
    const invalidFields = users.form.locator('input:invalid, select:invalid, textarea:invalid');
    await expect.poll(async () =>
      (await invalidFields.count()) > 0 || (await users.validationErrors.count()) > 0
    ).toBe(true);
  });

  test('UM10 — A user can be created with valid details', { tag: ['@functional', '@no-prod'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const user = createUser();

    await users.openAddUserForm();
    await users.fillUserForm(user);
    await users.submitUserForm();
    const row = users.rows.filter({ hasText: user.email });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: /delete/i }).click();
    await users.confirmAction();
    await expect(row).toHaveCount(0);
  });

  test('UM11 — Duplicate email is rejected during user creation', { tag: ['@functional', '@no-prod'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const existing = await users.firstUserDetails();

    await users.openAddUserForm();
    await users.fillUserForm({
      ...userManagementData.duplicateUser,
      email: existing.email,
    });
    await users.submitUserForm();
    await expect(users.validationErrors.filter({ hasText: /email|exist|duplicate/i }).first()).toBeVisible();
  });

  test('UM12 — Edit opens the selected user details', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const firstRow = users.rows.first();
    const email = await users.getCellValue(firstRow, /email/i);

    await firstRow.getByRole('button', { name: /edit/i }).click();
    await expect(users.form).toBeVisible();
    await expect(users.form.getByRole('textbox', { name: /email/i }).first()).toHaveValue(
      email
    );
  });

  test('UM13 — Updated user details are saved successfully', { tag: ['@functional', '@no-prod'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const user = createUser();
    await users.openAddUserForm();
    await users.fillUserForm(user);
    await users.submitUserForm();

    const row = users.rows.filter({ hasText: user.email });
    await expect(row).toBeVisible();
    const updatedName = `${user.name} Updated`;
    await row.getByRole('button', { name: /edit/i }).click();
    await users.fill(users.form.getByRole('textbox', { name: /name/i }).first(), updatedName);
    await users.submitUserForm();
    const updatedRow = users.rows.filter({ hasText: user.email });
    await expect(updatedRow).toContainText(updatedName);
    await updatedRow.getByRole('button', { name: /delete/i }).click();
    await users.confirmAction();
    await expect(updatedRow).toHaveCount(0);
  });

  test('UM14 — User deletion can be cancelled or confirmed', { tag: ['@functional', '@no-prod'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const user = createUser();

    await users.openAddUserForm();
    await users.fillUserForm(user);
    await users.submitUserForm();

    const row = users.rows.filter({ hasText: user.email });
    await row.getByRole('button', { name: /delete/i }).click();
    await expect(users.confirmationDialog).toBeVisible();
    await users.confirmationDialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: /delete/i }).click();
    await users.confirmAction();
    await expect(row).toHaveCount(0);
  });

  test('UM15 — Super Admin can activate and deactivate users', { tag: ['@functional', '@no-prod'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const user = createUser();
    await users.openAddUserForm();
    await users.fillUserForm(user);
    await users.submitUserForm();

    const row = users.rows.filter({ hasText: user.email });
    await expect(row).toBeVisible();
    const initialStatus = await users.getCellValue(row, /status/i);
    if (/^active$/i.test(initialStatus)) {
      await row.getByRole('button', { name: /deactivate/i }).click();
      await expect(row).toContainText(/inactive/i);
      await row.getByRole('button', { name: /activate/i }).click();
      await expect(row).toContainText(/active/i);
    } else {
      await row.getByRole('button', { name: /activate/i }).click();
      await expect(row).toContainText(/active/i);
      await row.getByRole('button', { name: /deactivate/i }).click();
      await expect(row).toContainText(/inactive/i);
    }
    await row.getByRole('button', { name: /delete/i }).click();
    await users.confirmAction();
    await expect(row).toHaveCount(0);
  });
});
