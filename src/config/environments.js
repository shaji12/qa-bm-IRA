const path = require('path');
const INSTANCES = ['qa', 'prod'];
const INSTANCE = String(process.env.TEST_ENV || 'qa').toLowerCase();

if (!INSTANCES.includes(INSTANCE)) {
  throw new Error(
    `Unknown TEST_ENV "${INSTANCE}". Use one of: ${INSTANCES.join(', ')} ` +
      `(e.g. npm run test:qa).`
  );
}


const ROOT = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(ROOT, `.env.${INSTANCE}`) });
require('dotenv').config({ path: path.join(ROOT, '.env') });


const ALLOW_PROD = process.env.ALLOW_PROD === 'true';


const environments = {
  bm_ira: {
    displayName: 'BM IRA',
    instance: INSTANCE,
    baseURL: process.env.BM_IRA_URL,

    // Admin, parent and student each sign in on a different page, so every
    // role carries its own login URL alongside its credentials.
    roles: {
      admin: {
        url: process.env.BM_IRA_ADMIN_URL,
        username: process.env.BM_IRA_ADMIN_USER,
        password: process.env.BM_IRA_ADMIN_PASS,
      },
      // parent: {
      //   url: process.env.BM_IRA_PARENT_URL,
      //   username: process.env.BM_IRA_PARENT_USER,
      //   password: process.env.BM_IRA_PARENT_PASS,
      // },
    },
  },
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

/**
 * The login URL and credentials for one role, e.g. requireCredentials('bm_ira', 'admin').
 * Stops with the exact variable names to fill in when any of them is empty.
 */
function requireCredentials(nameOrProject, role) {
  const key = toProjectKey(nameOrProject);
  const env = getEnv(key);
  const login = env.roles[role];
  if (!login) {
    throw new Error(
      `No "${role}" role configured for ${key}. Known roles: ${Object.keys(env.roles).join(', ')}`
    );
  }

  const prefix = `${key}_${role}`.toUpperCase();
  const missing = [];
  if (!env.baseURL) missing.push(`${key.toUpperCase()}_URL`);
  if (!login.url) missing.push(`${prefix}_URL`);
  if (!login.username) missing.push(`${prefix}_USER`);
  if (!login.password) missing.push(`${prefix}_PASS`);

  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')} for the "${INSTANCE}" instance. ` +
        `Copy .env.example to .env.${INSTANCE} and fill in the values.`
    );
  }
  return login;
}

module.exports = {
  getEnv,
  projectNames,
  requireCredentials,
  INSTANCE,
  ALLOW_PROD,
};
