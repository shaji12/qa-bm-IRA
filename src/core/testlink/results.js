
// Mixed case allowed: the BM Canteen project's TestLink prefix is "Canteen" (Canteen-52).
const CASE_TAG = /@([A-Za-z][A-Za-z0-9]*-\d+)\b/g;


const STATUS = {
  passed: 'p',
  failed: 'f',
  timedOut: 'f',
  interrupted: 'f',
  skipped: 'b',
};


function caseIdsIn(title) {
  return [...String(title).matchAll(CASE_TAG)].map((m) => m[1]);
}


function walkSuites(suite, trail, visit) {
  const file = suite.file || trail.file;
  const here = suite.title ? [...trail, suite.title] : [...trail];

  for (const spec of suite.specs || []) {
    visit(spec, here, file || suite.file);
  }
  for (const child of suite.suites || []) {
    walkSuites({ ...child, file: child.file || file }, here, visit);
  }
}


function readResults(report) {
  const out = [];

  for (const suite of report.suites || []) {
    walkSuites(suite, [], (spec, trail, file) => {
      for (const test of spec.tests || []) {
        const attempts = test.results || [];
        const final = attempts[attempts.length - 1] || {};

        out.push({
          title: spec.title,
          fullTitle: [...trail, spec.title].join(' › '),
          file,
          line: spec.line,
          project: test.projectName || '',
          caseIds: caseIdsIn(spec.title),
          status: STATUS[final.status] || 'b',
          playwrightStatus: final.status || 'unknown',
          durationMs: final.duration || 0,
          retries: Math.max(attempts.length - 1, 0),
          error: cleanError(final),
          screenshots: (final.attachments || [])
            .filter((a) => a.contentType === 'image/png' && a.path)
            .map((a) => a.path),
        });
      }
    });
  }

  return out;
}


function cleanError(result) {
  const raw = result.error?.message || result.errors?.[0]?.message || '';
  
  return raw.replace(/\[\d+m/g, '').trim();
}


function partition(results) {
  return {
    reportable: results.filter((r) => r.caseIds.length > 0),
    untagged: results.filter((r) => r.caseIds.length === 0),
  };
}


function findGaps(assignedIds, results) {
  const covered = new Set(results.flatMap((r) => r.caseIds));
  return assignedIds.filter((id) => !covered.has(id));
}


function grepFor(caseIds) {
  if (!caseIds.length) return null;
  const alternatives = caseIds.map((id) => `@${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return alternatives.join('|');
}

module.exports = { readResults, partition, findGaps, grepFor };
