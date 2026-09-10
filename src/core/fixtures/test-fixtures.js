const base = require('@playwright/test');
const { getEnv, INSTANCE, ALLOW_PROD } = require('../../config/environments');
const NO_PROD_TAG = '@no-prod';


const test = base.test.extend({
  env: async ({}, use, testInfo) => {
    // 'loyaltri-ui' and 'loyaltri-setup' both resolve to 'loyaltri'
    await use(getEnv(testInfo.project.name));
  },

 
  context: async ({ context, env }, use) => {
    if (env.sessionStorageSeed) {
      await context.addInitScript((seed) => {
        try {
          for (const [key, value] of Object.entries(seed)) {
            sessionStorage.setItem(key, value);
          }
        } catch {
          
        }
      }, env.sessionStorageSeed);
    }
    await use(context);
  },


  guardProduction: [
    async ({}, use, testInfo) => {
      
      const tagged =
        (testInfo.tags || []).includes(NO_PROD_TAG) || testInfo.title.includes(NO_PROD_TAG);

      testInfo.skip(
        INSTANCE === 'prod' && tagged && !ALLOW_PROD,
        `Tagged ${NO_PROD_TAG}: this test writes records, and the target is PRODUCTION. ` +
          `Re-run with ALLOW_PROD=true to override (npm run test:prod:unsafe).`
      );

      await use(undefined);
    },
    { auto: true },
  ],
});

const expect = base.expect;

module.exports = { test, expect };
