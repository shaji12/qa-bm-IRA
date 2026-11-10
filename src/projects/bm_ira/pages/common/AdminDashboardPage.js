const { BasePage } = require('../../../../core/base-page');


class AdminDashboardPage extends BasePage {
  constructor(page) {
    super(page, '/dashboard');


    this.heading = page.getByRole('heading', {name: 'Welcome to IRA Online Store Admin',level: 3});
    this.userMenuButton = page.getByText('Super Admin', { exact: true }).last();
    this.logoutMenuItem = page.getByRole('menuitem', { name: 'Logout',exact: true});
    this.logoutDialog = page.getByRole('alertdialog', {name: 'Logout'});
    this.confirmLogoutButton = this.logoutDialog.getByRole('button', {name: 'Logout', exact: true});
  }

  /**
   * The "Login Successful" toast lands on top of the User menu. Hovering a toast
   * pauses its timer, so a click that keeps retrying on it keeps it there
   * forever — close it instead (the codegen clicked it away too).
   */
  async dismissToast() {
    const close = this.page.getByRole('button', { name: 'Close toast' }).first();
    // Measured: the toast appears in the same millisecond as the User menu, so
    // an instant visibility check can miss it. Give it a moment to show up.
    await close.waitFor({ state: 'visible', timeout: 1000 }).catch(() => { });
    if (await this.isVisible(close)) {
      // It may time out on its own mid-click; either way it is gone.
      await close.click({ timeout: 2000 }).catch(() => { });
      await close.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
    }
  }

  async openLogoutDialog() {
    await this.dismissToast();
    await this.click(this.userMenuButton);
    await this.click(this.logoutMenuItem);
    await this.waitForVisible(this.logoutDialog);
  }

  async usermenu(){
    await this.click(this.userMenuButton)
  }

  async logout() {
    await this.dismissToast();
    await this.click(this.userMenuButton);
    await this.click(this.logoutMenuItem);
  }

}

module.exports = { AdminDashboardPage };
