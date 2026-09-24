
const { defineConfig, devices } = require('@playwright/test');
const { getEnv, projectNames, INSTANCE } = require('./src/config/environments');
const { authFile } = require('./src/core/constants/paths');


function buildProjects(key) {
  const env = getEnv(key);
  const root = `./src/projects/${key}`;
  const storageState = authFile(key);


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


console.log(`\n  Playwright target instance: ${INSTANCE.toUpperCase()}  (.env.${INSTANCE})\n`);

module.exports = defineConfig({
  testDir: './src/projects',
  testMatch: '**/*.spec.js',


  timeout: 120 * 1000,
  expect: { timeout: 10 * 1000 },

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : undefined,

 
  reporter: [
    ['html', { outputFolder: `reports/${INSTANCE}/html-report`, open: 'never' }],
    ['junit', { outputFile: `reports/${INSTANCE}/junit-results.xml` }],
    ['json', { outputFile: `reports/${INSTANCE}/results.json` }],
    ['list'],
  ],

  outputDir: `reports/${INSTANCE}/test-results`,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 60 * 1000,
    ignoreHTTPSErrors: true,
  },

  projects: projectNames().flatMap(buildProjects),
});
