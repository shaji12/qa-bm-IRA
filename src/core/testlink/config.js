
const VARS = {
  TESTLINK_URL: 'Base URL, e.g. https://testlink.loyaltri.in',
  TESTLINK_KEY: 'Your personal API key (TestLink -> My Settings -> Generate a new key)',
  TESTLINK_LOGIN: 'Your TestLink username — used to find cases assigned to you',
  TESTLINK_PROJECT: 'Test project name, exactly as it appears in TestLink',
};


const OPTIONAL = {
  TESTLINK_PLAN: 'Default test plan name; override per run with --plan',
};


const XMLRPC_PATH = '/lib/api/xmlrpc/v1/xmlrpc.php';


function loadTestLinkConfig(overrides = {}) {
  const missing = Object.keys(VARS).filter((name) => !process.env[name] && !overrides[name]);

  if (missing.length) {
    const lines = missing.map((name) => `    ${name.padEnd(18)} ${VARS[name]}`);
    const error = new Error(
      `TestLink is not configured. Missing from .env:\n\n${lines.join('\n')}\n\n` +
        `  Add them to .env in the repo root (gitignored). See .env.example.`
    );
    
    error.userFacing = true;
    throw error;
  }

  const base = String(overrides.TESTLINK_URL || process.env.TESTLINK_URL).replace(/\/+$/, '');

  return {
    endpoint: base + XMLRPC_PATH,
    key: overrides.TESTLINK_KEY || process.env.TESTLINK_KEY,
    login: overrides.TESTLINK_LOGIN || process.env.TESTLINK_LOGIN,
    project: overrides.TESTLINK_PROJECT || process.env.TESTLINK_PROJECT,
    plan: overrides.TESTLINK_PLAN || process.env.TESTLINK_PLAN || undefined,
  };
}

module.exports = { loadTestLinkConfig };
