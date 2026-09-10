const path = require('path');
const INSTANCES = ['alpha', 'staging', 'prod'];
const INSTANCE = String(process.env.TEST_ENV || 'alpha').toLowerCase();

if (!INSTANCES.includes(INSTANCE)) {
  throw new Error(
    `Unknown TEST_ENV "${INSTANCE}". Use one of: ${INSTANCES.join(', ')} ` +
      `(e.g. npm run test:staging).`
  );
}


const ROOT = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(ROOT, `.env.${INSTANCE}`) });
require('dotenv').config({ path: path.join(ROOT, '.env') });


const ALLOW_PROD = process.env.ALLOW_PROD === 'true';


const environments = {
  loyaltri: {
    displayName: 'Loyaltri',
    instance: INSTANCE,
    baseURL: process.env.LOYALTRI_URL,
    username: process.env.LOYALTRI_USER,
    password: process.env.LOYALTRI_PASS,

    
    sessionStorageSeed: { sessionActive: 'true', tabSession: 'active' },
  },

  // Add the next external project here, e.g.:
  // montes: {
  //   displayName: 'Montes',
  //   instance: INSTANCE,
  //   baseURL: process.env.MONTES_URL,
  //   username: process.env.MONTES_USER,
  //   password: process.env.MONTES_PASS,
  // },
};


const SUITE_SUFFIX = /-(setup|ui|api)$/;

function projectNames() {
  return Object.keys(environments);
}


function toProjectKey(playwrightProjectName) {
  return String(playwrightProjectName).replace(SUITE_SUFFIX, '');
}


function getEnv(nameOrProject) {
  const key = toProjectKey(nameOrProject);
  const env = environments[key];
  if (!env) {
    throw new Error(
      `No environment config found for project "${key}". ` +
        `Add it to src/config/environments.js. Known projects: ${projectNames().join(', ')}`
    );
  }
  return env;
}

function requireCredentials(nameOrProject) {
  const key = toProjectKey(nameOrProject);
  const env = getEnv(key);
  const missing = ['baseURL', 'username', 'password'].filter((field) => !env[field]);
  if (missing.length) {
    const vars = { baseURL: 'URL', username: 'USER', password: 'PASS' };
    throw new Error(
      `Missing ${missing.map((f) => `${key.toUpperCase()}_${vars[f]}`).join(' and ')} ` +
        `for the "${INSTANCE}" instance. ` +
        `Copy .env.example to .env.${INSTANCE} and fill in the values.`
    );
  }
  return env;
}

module.exports = {
  getEnv,
  projectNames,
  requireCredentials,
  INSTANCE,
  ALLOW_PROD,
};
