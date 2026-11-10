const { BasePage } = require('../../../../../../core/base-page');

class UserManagementPage extends BasePage {
  constructor(page) {
    super(page, '/user-management');

    this.userManagementMenu = page.locator('#root').getByText('User Management', { exact: true });
    this.heading = page.getByRole('heading', { name: 'User Management', exact: true });
    this.table = page.locator('table');
    this.headers = this.table.locator('thead th');
    this.rows = this.table.locator('tbody tr');
    this.searchInput = page.getByRole('textbox', { name: /search/i });
    this.newUserButton = page.getByRole('button', { name: /new user/i });
    this.form = page.locator('form').last();
    this.saveButton = page.getByRole('button', { name: /^(save|create user)$/i });
    this.cancelButton = page.getByRole('button', { name: /^cancel$/i });
    this.validationErrors = page.getByText(/required|invalid email|already exists|duplicate/i);
    this.confirmationDialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  }

  async navigateToUserManagement() {
    await this.click(this.userManagementMenu);
    await this.heading.waitFor({ state: 'visible' });
  }

  async openAddUserForm() {
    await this.click(this.newUserButton);
    await this.form.waitFor({ state: 'visible' });
  }

  async getCellValue(row, headerPattern) {
    const headerCount = await this.headers.count();
    for (let index = 0; index < headerCount; index += 1) {
      const header = (await this.headers.nth(index).innerText()).trim();
      if (headerPattern.test(header)) {
        return (await row.locator('td').nth(index).innerText()).trim();
      }
    }
    throw new Error(`Could not find a table column matching ${headerPattern}`);
  }

  async firstUserDetails() {
    const row = this.rows.first();
    return {
      name: await this.getCellValue(row, /name|user/i),
      email: await this.getCellValue(row, /email/i),
      institution: await this.getCellValue(row, /institution/i),
      role: await this.getCellValue(row, /role/i),
      status: await this.getCellValue(row, /status/i),
    };
  }

  async search(value) {
    await this.fill(this.searchInput, value);
  }

  async selectFilter(filterName, value) {
    const filter = this.page.getByRole('combobox', { name: new RegExp(filterName, 'i') }).first();
    if (await filter.count()) {
      await filter.selectOption({ label: value });
      return;
    }

    await this.click(this.page.getByRole('button', { name: new RegExp(filterName, 'i') }).first());
    await this.click(this.page.getByRole('option', { name: value, exact: true }).first());
  }

  async fillUserForm(user) {
    await this.fill(this.form.getByRole('textbox', { name: /name/i }).first(), user.name);
    await this.fill(this.form.getByRole('textbox', { name: /email/i }).first(), user.email);
    await this.selectFormValue('Institution', user.institution);
    await this.selectFormValue('Role', user.role);
  }

  async selectFormValue(label, value) {
    const select = this.form.getByRole('combobox', { name: new RegExp(label, 'i') }).first();
    if (await select.count()) {
      await select.selectOption({ label: value });
      return;
    }

    const field = this.form.getByRole('button', { name: new RegExp(label, 'i') }).first();
    await this.click(field);
    const option = this.page.getByRole('option', { name: value, exact: true }).first();
    if (await option.count()) {
      await option.click();
    } else {
      await this.click(this.page.getByText(value, { exact: true }).last());
    }
  }

  async submitUserForm() {
    await this.click(this.saveButton);
  }

  async confirmAction() {
    await this.click(this.confirmationDialog.getByRole('button', { name: /delete|confirm|yes/i }));
  }
}

module.exports = { UserManagementPage };
