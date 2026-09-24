
class BasePage {
 
  constructor(page, path = '/') {
    this.page = page;
    this.path = path;
  }

 
  async goto(path = this.path) {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

 
  async waitForVisible(locator, timeout = 15000) {
    await locator.waitFor({ state: 'visible', timeout });
  }

  
  async click(locator) {
    await this.waitForVisible(locator);
    await locator.click();
  }

 
  async fill(locator, value) {
    await this.waitForVisible(locator);
    await locator.fill(value);
  }

 
  async textOf(locator) {
    await this.waitForVisible(locator);
    return (await locator.textContent())?.trim() ?? '';
  }

 
  async isVisible(locator) {
    return locator.isVisible().catch(() => false);
  }
}

module.exports = { BasePage };
