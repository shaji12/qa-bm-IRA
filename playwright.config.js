// @ts-check
const { defineConfig, devices } = require('@playwright/test');
// environments.js loads the right .env.<instance> file as a side effect of
// being required, so it must come before anything that reads process.env.
const { getEnv, projectNames, INSTANCE } = require('./src/config/environments');
const { authFile } = require('./src/core/constants/paths');

/**
 * Every product gets two Playwright projects, generated from its key in
 * src/config/environments.js:
 *
 *   <key>-setup   logs in once, saves the session to .auth/<key>-<instance>.json
 *   <key>-ui      browser tests, reusing that session (no per-test login)
 *
 * There is deliberately no <key>-api project. API testing was removed to be
 * rebuilt from scratch; adding it back means restoring this project, an HTTP
 * client in src/core/, and an apiURL entry in environments.js.
 *
 * Adding a new product means adding ONE entry to environments.js. Nothing in
 * this file needs to change.
 *
 * Which INSTANCE (alpha/staging/prod) all of this points at comes from TEST_ENV,
 * resolved in environments.js. The projects below are identical whichever
 * instance is selected — only the URLs and credentials behind them change.
 *
 * @param {string} key project key, e.g. 'loyaltri'
 */
function buildProjects(key) {
  const env = getEnv(key);
  const root = `./src/projects/${key}`;
  // Instance-scoped, so a staging run never inherits an alpha session.
  const storageState = authFile(key);

  // Playwright's Desktop Chrome default is 1280x720. Loyaltri's left module
  // rail is `hidden lg:block` and collapses below the app's lg breakpoint at
  // that width, which hides the primary navigation from every test. 1920x1080
  // is what the app is actually used at.
  const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } };

  return [
    {
      name: `${key}-setup`,
      testDir: root,
      testMatch: /auth\.setup\.js/,
      use: { ...desktop, baseURL: env.baseURL },
    },
    {
      name: `${key}-ui`,
      testDir: `${root}/tests/ui`,
      dependencies: [`${key}-setup`],
      use: { ...desktop, baseURL: env.baseURL, storageState },
    },
  ];
}

// Make the target instance impossible to miss in the terminal — the most
// expensive mistake here is not knowing which server you just tested.
console.log(`\n  Playwright target instance: ${INSTANCE.toUpperCase()}  (.env.${INSTANCE})\n`);

module.exports = defineConfig({
  testDir: './src/projects',
  testMatch: '**/*.spec.js',

  // Alpha is a shared, slow environment: the initial page load has been
  // measured taking well over 30s when a couple of workers hit it at once.
  // The test timeout must stay comfortably above navigationTimeout below, or a
  // slow load fails the test before navigation gets a chance to give up.
  timeout: 120 * 1000,
  expect: { timeout: 10 * 1000 },

  forbidOnly: !!process.env.CI,

  // One local retry absorbs the environment's cold-start timeouts. Retries do
  // not hide anything: a test that only passes on retry is reported as
  // "flaky", so genuine instability stays visible.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : undefined,

  // Reports are scoped per instance so a staging run doesn't overwrite the alpha
  // results you were about to read. The JUnit XML is what TestLink imports.
  reporter: [
    ['html', { outputFolder: `reports/${INSTANCE}/html-report`, open: 'never' }],
    ['junit', { outputFile: `reports/${INSTANCE}/junit-results.xml` }],
    // The TestLink publisher reads this one. JSON rather than the JUnit XML
    // because it carries the per-attempt detail we push as execution notes:
    // error messages, retries, and the paths of failure screenshots.
    ['json', { outputFile: `reports/${INSTANCE}/results.json` }],
    ['list'],
  ],

  outputDir: `reports/${INSTANCE}/test-results`,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    // 30s was not enough for alpha's first paint under parallel load — three
    // separate tests died on page.goto at exactly that limit.
    navigationTimeout: 60 * 1000,
    ignoreHTTPSErrors: true,
  },

  projects: projectNames().flatMap(buildProjects),
});
