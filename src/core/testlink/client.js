const { buildRequest, parseResponse, XmlRpcFault } = require('./xmlrpc');


class TestLinkClient {

  constructor(config, options = {}) {
    this.endpoint = config.endpoint;
    this.key = config.key;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.log = options.log || (() => {});
  }

  
  async call(method, params = {}) {
    const body = buildRequest(`tl.${method}`, { devKey: this.key, ...params });
    this.log(`  -> tl.${method}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`tl.${method} timed out after ${this.timeoutMs}ms (${this.endpoint})`);
      }
      throw new Error(`tl.${method} could not reach ${this.endpoint}: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();

   
    if (!response.ok) {
      throw new Error(`tl.${method} returned HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return parseResponse(text);
  }

  // -------------------------------------------------------------------------
  // Connectivity
  // -------------------------------------------------------------------------

  /** True when the dev key is valid. Run this before anything else. */
  async checkDevKey() {
    return this.call('checkDevKey', { devKey: this.key });
  }



  async getProjects() {
    return this.call('getProjects');
  }

  async getProjectTestPlans(testprojectid) {
    const plans = await this.call('getProjectTestPlans', { testprojectid });
  
    return Array.isArray(plans) ? plans : [];
  }

  async getBuildsForTestPlan(testplanid) {
    const builds = await this.call('getBuildsForTestPlan', { testplanid });
    return Array.isArray(builds) ? builds : [];
  }

  async getUserByLogin(user) {
    const found = await this.call('getUserByLogin', { user });
    return Array.isArray(found) ? found[0] : found;
  }

  // -------------------------------------------------------------------------
  // The assignment
  // -------------------------------------------------------------------------


  async getTestCasesForTestPlan(testplanid, extra = {}) {
    return this.call('getTestCasesForTestPlan', { testplanid, ...extra });
  }

  async getTestSuitesForTestPlan(testplanid) {
    const suites = await this.call('getTestSuitesForTestPlan', { testplanid });
    if (Array.isArray(suites)) return suites;
    return suites && typeof suites === 'object' ? [suites] : [];
  }

  async getTestCasesForTestSuite(testsuiteid, deep = true) {
    const cases = await this.call('getTestCasesForTestSuite', {
      testsuiteid,
      deep,
      details: 'simple',
    });
    if (Array.isArray(cases)) return cases;
    return cases && typeof cases === 'object' ? Object.values(cases).flat() : [];
  }

  // -------------------------------------------------------------------------
  // Publishing results
  // -------------------------------------------------------------------------


  async reportTCResult(args) {
    const result = await this.call('reportTCResult', {
      overwrite: false,
      ...args,
    });
    return Array.isArray(result) ? result[0] : result;
  }


  async uploadExecutionAttachment(executionid, filename, content, filetype = 'image/png') {
    return this.call('uploadExecutionAttachment', {
      executionid,
      filename,
      filetype,
      content: content.toString('base64'),
      title: filename,
      description: 'Attached automatically by the Playwright run',
    });
  }
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------


function flattenTestCases(raw) {
  if (!raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw)) return raw;

  const out = [];
  for (const entry of Object.values(raw)) {
    if (Array.isArray(entry)) out.push(...entry);
    else if (entry && typeof entry === 'object') out.push(entry);
  }
  return out;
}


function externalIdOf(testCase, prefix) {
  if (testCase.full_external_id) return String(testCase.full_external_id).trim();

  const raw = testCase.external_id;
  if (raw === null || raw === undefined || raw === '') return null;

  const value = String(raw).trim();

  if (/^[A-Za-z]/.test(value)) return value;

  return prefix ? `${prefix}-${value}` : null;
}

function findByName(list, nameField, wanted) {
  const target = String(wanted).trim().toLowerCase();
  return list.find((item) => String(item[nameField] || '').trim().toLowerCase() === target);
}

module.exports = {
  TestLinkClient,
  flattenTestCases,
  externalIdOf,
  findByName,
  XmlRpcFault,
};
