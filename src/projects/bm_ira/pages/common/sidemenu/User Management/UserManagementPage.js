const { BasePage } = require('../../../../../../core/base-page');

class UserManagementPage extends BasePage {
  constructor(page) {
    super(page, '/user-management');

    this.userManagementMenu = page.locator('#root').getByText('User Management', { exact: true });
    this.heading = page.getByRole('heading', { name: 'User Management', exact: true });
    this.table = page.locator('table');
    this.headers = this.table.locator('thead th');
    this.rows = this.table.locator('tbody tr');
    this.searchInput = page.getByRole('textbox', { name: /search by name, email, or institution/i });
    this.sortButton = page.getByRole('button', { name: 'Sort', exact: true });
    this.filterButton = page.getByRole('button', { name: /^Filter\b/i });
    this.filterMenu = page.locator('div.absolute.right-0.mt-2.bg-white.shadow-lg.rounded-md.z-50.w-64');
    this.newUserButton = page.getByRole('button', { name: /new user/i });
    this.form = page.getByRole('textbox', { name: /name\*/i })
      .locator('xpath=ancestor::div[.//button[normalize-space()="Submit"]][1]');
    this.saveButton = page.getByRole('button', { name: /^(submit|save|create user)$/i });
    this.cancelButton = page.getByRole('button', { name: /^cancel$/i });
    this.validationErrors = page.getByText(/required|invalid email|already exists|duplicate/i);
    this.confirmationDialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  }

  async navigateToUserManagement() {
    await this.click(this.userManagementMenu);
    await this.heading.waitFor({ state: 'visible' });
    await this.waitForDataRows();
  }

  async waitForDataRows() {
    await this.page.waitForFunction(() => {
      const firstRow = document.querySelector('table tbody tr');
      return Boolean(firstRow && !firstRow.querySelector('[data-slot="skeleton"]'));
    });
  }

  async openAddUserForm() {
    await this.click(this.newUserButton);
    await this.form.waitFor({ state: 'visible' });
  }

  async getCell(row, headerPattern) {
    const headerCount = await this.headers.count();
    for (let index = 0; index < headerCount; index += 1) {
      const header = (await this.headers.nth(index).innerText()).trim();
      if (headerPattern.test(header)) {
        return row.locator('td').nth(index);
      }
    }
    throw new Error(`Could not find a table column matching ${headerPattern}`);
  }

  async getCellValue(row, headerPattern) {
    const cell = await this.getCell(row, headerPattern);
    const value = cell.locator('span.font-medium').last();
    if (await value.count()) {
      return (await value.innerText()).trim();
    }
    return (await cell.innerText()).trim();
  }

  async getStatus(row) {
    const statusCell = await this.getCell(row, /status/i);
    const toggle = statusCell.locator('[role="switch"], input[type="checkbox"]');
    if (await toggle.count()) {
      const checked = await toggle.first().getAttribute('aria-checked');
      if (checked !== null) {
        return checked === 'true' ? 'Active' : 'Inactive';
      }
      return (await toggle.first().isChecked()) ? 'Active' : 'Inactive';
    }

    const status = (await statusCell.innerText()).trim();
    if (!status) {
      throw new Error('The Status cell has neither status text nor a checked toggle');
    }
    return status;
  }

  async firstUserDetails() {
    const row = this.rows.first();
    return {
      name: await this.getCellValue(row, /^name$/i),
      email: await this.getCellValue(row, /email/i),
      institution: await this.getCellValue(row, /institution/i),
      role: await this.getCellValue(row, /role/i),
      status: await this.getStatus(row),
    };
  }

  async search(value) {
    await this.fill(this.searchInput, value);
  }

  async selectFilter(filterName, value) {
    await this.click(this.filterButton);
    const filterLabel = this.filterMenu.getByText(filterName, { exact: true });
    if (!(await filterLabel.isVisible())) {
      throw new Error(`The Filter menu does not offer a "${filterName}" filter`);
    }
    await this.click(filterLabel);

    if (/^institution$/i.test(filterName)) {
      await this.filterMenu.getByPlaceholder('Search institution...').waitFor({ state: 'visible' });
      const options = this.filterMenu.locator('div.max-h-40 > div.cursor-pointer');
      await options.first().waitFor({ state: 'visible' });
      const labels = await options.allInnerTexts();
      const normalize = (label) => label.trim().toLocaleLowerCase().replace(/s$/, '');
      const optionIndex = labels.findIndex((label) => normalize(label) === normalize(value));
      if (optionIndex < 0) {
        throw new Error(`Institution filter option "${value}" was not found`);
      }
      await this.click(options.nth(optionIndex));
    } else {
      const option = this.filterMenu.getByText(value, { exact: true });
      if (!(await option.isVisible())) {
        throw new Error(`The Filter menu does not offer "${value}" for ${filterName}`);
      }
      await this.click(option);
    }

    const applyButton = this.filterMenu.getByRole('button', { name: 'Apply Filters', exact: true });
    if (await applyButton.isVisible()) {
      await this.click(applyButton);
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
      await this.waitForDataRows();
    }
    return value;
  }

  async fillUserForm(user) {
    await this.fill(this.form.getByRole('textbox', { name: /name/i }).first(), user.name);
    await this.fill(this.form.getByRole('textbox', { name: /email/i }).first(), user.email);
    if (user.password) {
      await this.fill(this.form.getByRole('textbox', { name: /password/i }).first(), user.password);
    }
    await this.selectFormValue('Institution', user.institution);
    await this.selectFormValue('Role', user.role);
  }

  async selectFormValue(label, value) {
    const select = this.form.getByRole('combobox', { name: new RegExp(label, 'i') }).first();
    if (await select.count()) {
      if ((await select.evaluate((element) => element.tagName.toLowerCase())) === 'select') {
        await select.selectOption({ label: value });
      } else {
        await this.click(select);
        await this.click(this.page.getByRole('option', { name: value, exact: true }).last());
      }
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

  async editUser(row) {
    await this.click(row.getByRole('button').first());
  }

  async deleteUser(row) {
    await this.click(row.getByRole('button').nth(1));
  }

  async confirmAction() {
    await this.click(this.confirmationDialog.getByRole('button', { name: /^(delete|confirm|yes)$/i }));
  }
}

module.exports = { UserManagementPage };
