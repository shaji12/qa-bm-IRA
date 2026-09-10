const { BasePage } = require('../../../core/base-page');
const { LoginPage } = require('./LoginPage');

/**
 * The Loyaltri dashboard.
 *
 * Loyaltri is a single-page app that serves the login form AND the dashboard
 * from '/', so the URL is identical before and after signing in. These locators
 * are the session markers — they only exist once authenticated.
 *
 * Locators only, no methods: everything the specs need is an assertion on one
 * of these. Logout lives on LoginPage, next to the login it undoes.
 */
class DashboardPage extends BasePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    super(page, '/');

    this.sidebar = page.getByRole('complementary');
    this.topBar = page.getByRole('navigation');
    this.requestsPanel = page.getByRole('heading', { name: 'Requests' });
    this.attendancePanel = page.getByRole('heading', { name: 'Attendance Summary' });

    // The account menu is defined once on LoginPage (it is the most fragile
    // locator in the suite) and reused here rather than duplicated.
    this.userMenu = new LoginPage(page).accountMenu;
  }
}

module.exports = { DashboardPage };
