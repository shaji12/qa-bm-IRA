/**
 * BasePage — shared behaviour every Page Object inherits.
 *
 * Project pages (e.g. src/projects/loyaltri/pages/LoginPage.js) extend this and
 * declare their own locators in the constructor.
 *
 * Navigation uses RELATIVE paths ('/login', '/dashboard'). The host comes from
 * the per-project `baseURL` in playwright.config.js, so no page object ever
 * hardcodes an environment.
 *
 * Every action waits for its element first, so specs rarely need explicit waits.
 * Only the methods actually used by the suite live here — add more when a test
 * needs them, not before.
 */
class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [path] default route for this page, e.g. '/login'
   */
  constructor(page, path = '/') {
    this.page = page;
    this.path = path;
  }

  /**
   * Navigate to this page's route, or an explicit relative path.
   * @param {string} [path]
   */
  async goto(path = this.path) {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  /** @param {import('@playwright/test').Locator} locator */
  async waitForVisible(locator, timeout = 15000) {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /** @param {import('@playwright/test').Locator} locator */
  async click(locator) {
    await this.waitForVisible(locator);
    await locator.click();
  }

  /**
   * @param {import('@playwright/test').Locator} locator
   * @param {string} value
   */
  async fill(locator, value) {
    await this.waitForVisible(locator);
    await locator.fill(value);
  }

  /** Trimmed text of an element. @param {import('@playwright/test').Locator} locator */
  async textOf(locator) {
    await this.waitForVisible(locator);
    return (await locator.textContent())?.trim() ?? '';
  }

  /** Soft check — returns false instead of throwing when the element is absent. */
  async isVisible(locator) {
    return locator.isVisible().catch(() => false);
  }
}

module.exports = { BasePage };
