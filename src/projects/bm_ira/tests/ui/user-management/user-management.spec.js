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
    expect(headerTexts).toEqual(userTableHeadersExpected);
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
    await users.sortButton.click();
    await users.page.getByRole('button', { name: '↑', exact: true }).first().click();
    await users.sortButton.click();
    const names = await Promise.all(
      (await users.rows.all()).map((row) => users.getCellValue(row, /name/i))
    );
    expect(names.length).toBeGreaterThan(1);
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
    const clearButton = users.page.getByRole('button', { name: 'Clear', exact: true });
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }
  });

  test('UM05 — Users can be filtered by institution', { tag: ['@functional'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const details = await users.firstUserDetails();

    await users.selectFilter('Institution', details.institution);
    expect(await users.rows.count()).toBeGreaterThan(0);
    for (const row of await users.rows.all()) {
      const institution = await users.getCellValue(row, /institution/i);
      expect(institution.trim().toLocaleLowerCase().replace(/s$/, '')).toBe(
        details.institution.trim().toLocaleLowerCase().replace(/s$/, '')
      );
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
    await expect(users.rows.first().locator('[role="switch"]')).toHaveAttribute('aria-checked', 'true');
    for (const row of await users.rows.all()) {
      await expect(row.locator('[role="switch"]')).toHaveAttribute('aria-checked', 'true');
    }

    await users.filterButton.click();
    await users.filterMenu.getByRole('button', { name: 'Clear All Filters', exact: true }).click();
    await users.selectFilter('Status', 'Inactive');
    expect(await users.rows.count()).toBeGreaterThan(0);
    await expect(users.rows.first().locator('[role="switch"]')).toHaveAttribute('aria-checked', 'false');
    for (const row of await users.rows.all()) {
      await expect(row.locator('[role="switch"]')).toHaveAttribute('aria-checked', 'false');
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
    await users.search(user.email);
    const row = users.rows.filter({ hasText: user.email });
    await expect(row).toBeVisible();
    await users.deleteUser(row);
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

    await users.editUser(firstRow);
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
    await users.search(user.email);

    const row = users.rows.filter({ hasText: user.email });
    await expect(row).toBeVisible();
    const updatedName = `${user.name} Updated`;
    await users.editUser(row);
    await users.fill(users.form.getByRole('textbox', { name: /name/i }).first(), updatedName);
    await users.submitUserForm();
    const updatedRow = users.rows.filter({ hasText: user.email });
    await expect(updatedRow).toContainText(updatedName);
    await users.deleteUser(updatedRow);
    await users.confirmAction();
    await expect(updatedRow).toHaveCount(0);
  });

  test('UM14 — User deletion can be cancelled or confirmed', { tag: ['@functional', '@no-prod'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const user = createUser();

    await users.openAddUserForm();
    await users.fillUserForm(user);
    await users.submitUserForm();

    await users.search(user.email);
    const row = users.rows.filter({ hasText: user.email });
    await users.deleteUser(row);
    await expect(users.confirmationDialog).toBeVisible();
    await users.confirmationDialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(row).toBeVisible();

    await users.deleteUser(row);
    await users.confirmAction();
    await expect(row).toHaveCount(0);
  });

  test('UM15 — Super Admin can activate and deactivate users', { tag: ['@functional', '@no-prod'] }, async ({ page }) => {
    const users = await openUserManagement(page);
    const user = createUser();
    await users.openAddUserForm();
    await users.fillUserForm(user);
    await users.submitUserForm();

    await users.search(user.email);
    const row = users.rows.filter({ hasText: user.email });
    await expect(row).toBeVisible();
    const statusToggle = (await users.getCell(row, /status/i)).locator('[role="switch"]');
    await expect(statusToggle).toHaveAttribute('aria-checked', 'true');
    await statusToggle.click();
    await expect(statusToggle).toHaveAttribute('aria-checked', 'false');
    await statusToggle.click();
    await expect(statusToggle).toHaveAttribute('aria-checked', 'true');
    await users.deleteUser(row);
    await users.confirmAction();
    await expect(row).toHaveCount(0);
  });
});
