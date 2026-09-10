#!/usr/bin/env node
/**
 * Run the TestLink cases assigned to you, then publish the results back.
 *
 *   npm run testlink -- --build "Sprint-24-RC1"
 *
 * What it does, in order:
 *
 *   1. Reads TestLink settings from .env
 *   2. Resolves Project -> Plan -> Build names into the numeric IDs the API wants
 *   3. Fetches the cases in that plan assigned to YOU
 *   4. Turns their IDs into a Playwright --grep
 *   5. Runs Playwright against whichever instance TEST_ENV selects
 *   6. Reads reports/<instance>/results.json
 *   7. Posts each result to TestLink, attaching screenshots for failures
 *   8. Lists assigned cases that have no automated test yet
 *
 * The link between TestLink and a spec is the tag in the test title:
 *
 *   test('TC01 — Successful login @LOYTRI-37', ...)
 *
 * That tag both SELECTS the test and ADDRESSES the result. There is no mapping
 * file, because a mapping file drifts and a tag in a title cannot.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// MUST come first: requiring environments.js is what loads the .env files, so
// nothing can read process.env.TESTLINK_* before this line.
const { INSTANCE } = require('../src/config/environments');

const { loadTestLinkConfig } = require('../src/core/testlink/config');
const {
  TestLinkClient,
  flattenTestCases,
  externalIdOf,
  findByName,
} = require('../src/core/testlink/client');
const { readResults, partition, findGaps, grepFor } = require('../src/core/testlink/results');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const USAGE = `
  Run your assigned TestLink cases and publish the results.

  Usage
    npm run testlink -- --build "Sprint-24-RC1"

  Options
    --build   <name>   Build to execute against            (required)
    --plan    <name>   Test plan; defaults to TESTLINK_PLAN in .env
    --project <name>   Test project; defaults to TESTLINK_PROJECT
    --suite   <name>   Only cases from this test suite
    --all              Every case in the plan, not just yours
    --dry-run          Run the tests, print what WOULD be posted, post nothing
    --help

  Which server the tests run against comes from TEST_ENV, exactly as it does
  for a normal run:

    npm run testlink -- --build "RC1"                   (alpha, the default)
    cross-env TEST_ENV=staging npm run testlink -- --build "RC1"
`;

function parseArgs(argv) {
  const args = { flags: new Set() };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const name = token.slice(2);
    if (['dry-run', 'help', 'all'].includes(name)) {
      args.flags.add(name);
    } else {
      args[name] = argv[++i];
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Small output helpers — plain text, because this runs in a terminal that may
// not support colour, and the output ends up pasted into tickets.
// ---------------------------------------------------------------------------

const say = (msg = '') => process.stdout.write(`${msg}\n`);
const heading = (msg) => say(`\n${msg}\n${'-'.repeat(msg.length)}`);

/**
 * Thrown by fail(). Signals "stop, the message is already printed" rather than
 * an unexpected crash, so the top-level handler knows not to print a stack.
 */
class CleanExit extends Error {}

/**
 * Reports a problem the user can act on, and stops.
 *
 * Deliberately does NOT call process.exit(). On Windows, exiting while stdout
 * still has buffered writes truncates the message and can abort the process
 * with a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`). Throwing and
 * setting exitCode lets Node drain its output and exit on its own terms.
 */
const fail = (msg) => {
  process.stderr.write(`\n  ERROR  ${msg}\n\n`);
  throw new CleanExit();
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.flags.has('help')) {
    say(USAGE);
    return;
  }
  if (!args.build) {
    fail('--build is required. Try: npm run testlink -- --build "Sprint-24-RC1"\n' + USAGE);
  }

  const dryRun = args.flags.has('dry-run');
  const config = loadTestLinkConfig();
  const planName = args.plan || config.plan;
  const projectName = args.project || config.project;

  if (!planName) {
    fail('No test plan. Pass --plan "Name" or set TESTLINK_PLAN in .env.');
  }

  const client = new TestLinkClient(config);

  // --- Connectivity and key -------------------------------------------------

  heading('TestLink');
  say(`  Server   ${config.endpoint}`);

  try {
    await client.checkDevKey();
  } catch (err) {
    fail(
      `${err.message}\n\n  Generate a key in TestLink: My Settings -> ` +
        `Generate a new API key, then set TESTLINK_KEY in .env`
    );
  }
  say(`  Key      valid (${config.login})`);

  // --- Names to IDs ---------------------------------------------------------

  const projects = await client.getProjects();
  const project = findByName(projects, 'name', projectName);
  if (!project) {
    fail(
      `No test project named "${projectName}".\n  Available: ` +
        projects.map((p) => p.name).join(', ')
    );
  }

  const plans = await client.getProjectTestPlans(project.id);
  const plan = findByName(plans, 'name', planName);
  if (!plan) {
    fail(
      `No test plan named "${planName}" in ${project.name}.\n  Available: ` +
        (plans.map((p) => p.name).join(', ') || '(none — create one in Test Plan Management)')
    );
  }

  const builds = await client.getBuildsForTestPlan(plan.id);
  const build = findByName(builds, 'name', args.build);
  if (!build) {
    fail(
      `No build named "${args.build}" in plan "${plan.name}".\n  Available: ` +
        (builds.map((b) => b.name).join(', ') ||
          '(none — create one under the plan: Builds/Releases)')
    );
  }

  say(`  Project  ${project.name}  (id ${project.id}, prefix ${project.prefix})`);
  say(`  Plan     ${plan.name}  (id ${plan.id})`);
  say(`  Build    ${build.name}  (id ${build.id})`);
  say(`  Target   ${INSTANCE.toUpperCase()} instance (.env.${INSTANCE})`);

  // --- The assignment -------------------------------------------------------

  const raw = await client.getTestCasesForTestPlan(plan.id);
  let cases = flattenTestCases(raw);

  if (!cases.length) {
    fail(
      `Plan "${plan.name}" has no test cases.\n` +
        `  In TestLink: open the plan -> Add / Remove Test Cases.`
    );
  }

  const totalInPlan = cases.length;

  // Narrow to this tester unless --all.
  //
  // Verified against TestLink 1.9.20: getTestCasesForTestPlan NEVER returns an
  // assignee field — not user_id, not assigned_to, under any combination of the
  // details/buildid parameters. So filtering client-side is impossible.
  //
  // It does, however, accept `assignedto` as a SERVER-SIDE filter, and that
  // works. So ask TestLink for the narrowed list rather than trying to narrow a
  // list that carries no assignment data.
  let scope = 'whole plan';

  if (!args.flags.has('all')) {
    const me = await client.getUserByLogin(config.login).catch(() => null);
    const myId = me && (me.dbID || me.id);

    if (!myId) {
      say('');
      say(`  NOTE  TestLink has no user "${config.login}", so the whole plan will run.`);
      say('        Check TESTLINK_LOGIN in .env — it is your TestLink username,');
      say('        not your email address.');
    } else {
      const mine = flattenTestCases(
        await client.getTestCasesForTestPlan(plan.id, { assignedto: myId })
      );

      if (mine.length) {
        cases = mine;
        scope = `assigned to ${config.login}`;
      } else {
        // Nothing assigned is a setup gap, not an error. Say what to do about
        // it, then run the whole plan rather than doing nothing at all.
        say('');
        say(`  NOTE  Nothing in this plan is assigned to "${config.login}", so all`);
        say(`        ${cases.length} cases will run. To assign: TestLink -> open the plan`);
        say(`        -> Assign Test Case Execution -> pick build "${build.name}".`);
        say('        Pass --all to silence this note.');
      }
    }
  }

  // Narrow to one test suite.
  //
  // getTestCasesForTestPlan returns no suite information whatsoever, so this
  // cannot be done by filtering the list we already have. Instead: look up the
  // suite by name, ask which cases live in it (deep, so naming a parent suite
  // includes its children), and intersect.
  if (args.suite) {
    const suites = await client.getTestSuitesForTestPlan(plan.id);
    const suite = findByName(suites, 'name', args.suite);

    if (!suite) {
      fail(
        `No test suite named "${args.suite}" in plan "${plan.name}".\n  Available: ` +
          (suites.map((s) => `"${s.name}"`).join(', ') || '(none)')
      );
    }

    const inSuite = await client.getTestCasesForTestSuite(suite.id);
    const wanted = new Set(
      inSuite.map((tc) => externalIdOf(tc, project.prefix)).filter(Boolean)
    );

    cases = cases.filter((c) => wanted.has(externalIdOf(c, project.prefix)));
  }

  // Map to the external IDs that appear in spec titles.
  const assigned = cases
    .map((c) => ({ id: externalIdOf(c, project.prefix), tcase: c }))
    .filter((c) => c.id);

  const assignedIds = [...new Set(assigned.map((a) => a.id))];

  heading('Assignment');
  say(`  Cases in plan          ${totalInPlan}`);
  say(`  Will run               ${assignedIds.length}   (${args.flags.has('all') ? 'whole plan, --all' : scope})`);
  if (args.suite) say(`  Filtered to suite      ${args.suite}`);

  if (!assignedIds.length) {
    fail(
      `No cases left to run.\n` +
        (args.suite
          ? `  No case in this plan belongs to suite "${args.suite}".\n`
          : `  In TestLink: open the plan -> Assign Test Case Execution -> pick build ` +
            `"${build.name}" -> assign cases to ${config.login}.\n`) +
        `  Or pass --all to run every case in the plan.`
    );
  }

  say(`  ${assignedIds.join(', ')}`);

  // --- Run Playwright -------------------------------------------------------

  const grep = grepFor(assignedIds);

  heading('Running');
  say(`  playwright test --grep "${grep}"\n`);

  // Invoke Playwright's CLI through node directly rather than via `npx`.
  //
  // Two Windows problems this avoids:
  //   1. With shell:true, cmd.exe treats the "|" separating our case IDs as a
  //      PIPE, so the grep is torn apart and the run does the wrong thing.
  //   2. Without shell:true, Node refuses to spawn npx.cmd at all (the fix for
  //      CVE-2024-27980 blocks .cmd/.bat without a shell).
  //
  // Calling cli.js with the current node binary sidesteps both, and needs no
  // argument escaping on any platform.
  const run = spawnSync(process.execPath, [resolvePlaywrightCli(), 'test', '--grep', grep], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // A non-zero exit means tests failed, which is normal and must NOT stop us —
  // failures are exactly what we came here to report.
  if (run.error) {
    fail(`Could not start Playwright: ${run.error.message}`);
  }

  // --- Read the results -----------------------------------------------------

  const resultsPath = path.join(ROOT, 'reports', INSTANCE, 'results.json');
  if (!fs.existsSync(resultsPath)) {
    fail(
      `Playwright wrote no results at ${resultsPath}.\n` +
        `  The run probably failed before any test started — check the output above.`
    );
  }

  const report = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  const results = readResults(report);
  const { reportable, untagged } = partition(results);
  const gaps = findGaps(assignedIds, results);

  // --- Publish --------------------------------------------------------------

  heading(dryRun ? 'Would post (dry run)' : 'Posting to TestLink');

  const counts = { p: 0, f: 0, b: 0 };
  let posted = 0;
  const problems = [];

  for (const result of reportable) {
    for (const caseId of result.caseIds) {
      // Only publish what was actually assigned — a spec may carry a tag for a
      // case in a different plan, and that result does not belong here.
      if (!assignedIds.includes(caseId)) continue;

      counts[result.status] = (counts[result.status] || 0) + 1;
      const notes = buildNotes(result);

      if (dryRun) {
        say(`  ${caseId.padEnd(12)} ${labelFor(result.status)}  ${result.title}`);
        continue;
      }

      try {
        const execution = await client.reportTCResult({
          testcaseexternalid: caseId,
          testplanid: plan.id,
          buildid: build.id,
          status: result.status,
          notes,
          user: config.login,
        });

        posted++;
        say(`  ${caseId.padEnd(12)} ${labelFor(result.status)}  ${result.title}`);

        const executionId = execution && (execution.id || execution.execution_id);
        if (executionId && result.status === 'f') {
          await attachScreenshots(client, executionId, result, problems);
        }
      } catch (err) {
        problems.push(`${caseId}: ${err.message}`);
        say(`  ${caseId.padEnd(12)} NOT POSTED  ${err.message}`);
      }
    }
  }

  // --- Summary --------------------------------------------------------------

  heading('Summary');
  say(`  Passed   ${counts.p || 0}`);
  say(`  Failed   ${counts.f || 0}`);
  say(`  Blocked  ${counts.b || 0}   (skipped — never ran, which is not a pass)`);
  say(dryRun ? '\n  Dry run: nothing was posted.' : `\n  Posted to TestLink: ${posted}`);

  if (gaps.length) {
    heading('Assigned but not automated');
    say('  No spec carries these tags yet:\n');
    for (const id of gaps) {
      const match = assigned.find((a) => a.id === id);
      say(`    ${id.padEnd(12)} ${match ? match.tcase.name || '' : ''}`);
    }
    say('\n  Add the tag to a spec title to automate one, e.g.');
    say(`    test('TC16 — ... ${gaps[0]}', async ({ page }) => { ... })`);
  }

  if (untagged.length) {
    heading('Ran but not reported');
    say(`  ${untagged.length} test(s) carry no TestLink tag, so there was nowhere to report them.`);
  }

  if (problems.length) {
    heading('Problems');
    problems.forEach((p) => say(`  ${p}`));
    process.exitCode = 1;
  }

  say('');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Absolute path to Playwright's CLI entry point.
 *
 * require.resolve('@playwright/test/cli.js') does NOT work: the package's
 * "exports" map deliberately hides that subpath. Resolving its package.json is
 * allowed, though, so locate the package directory that way and join.
 */
function resolvePlaywrightCli() {
  const candidates = [];

  try {
    candidates.push(
      path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js')
    );
  } catch {
    // Not resolvable from here — fall through to the layout-based guess.
  }
  candidates.push(path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'));

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      'Could not locate Playwright. Run `npm install`, then try again.\n' +
        `  Looked in:\n${candidates.map((c) => `    ${c}`).join('\n')}`
    );
  }
  return found;
}

function labelFor(status) {
  return { p: 'PASS   ', f: 'FAIL   ', b: 'BLOCKED' }[status] || status;
}

/**
 * The execution note left in TestLink.
 *
 * Written to be readable by someone looking at the case in TestLink weeks
 * later, with no access to the terminal output: what ran, where, how long, and
 * what broke.
 */
function buildNotes(result) {
  const lines = [
    `Automated: ${result.title}`,
    `Instance:  ${INSTANCE}`,
    `Project:   ${result.project}`,
    `Duration:  ${(result.durationMs / 1000).toFixed(1)}s`,
  ];

  if (result.retries > 0) {
    lines.push(`Retries:   ${result.retries}  (FLAKY — passed only on retry)`);
  }
  if (result.error) {
    lines.push('', 'Error:', result.error.slice(0, 1500));
  }
  if (result.file) {
    lines.push('', `Spec: ${result.file}:${result.line}`);
  }
  return lines.join('\n');
}

/** Attaches failure screenshots, without letting an upload failure lose the result. */
async function attachScreenshots(client, executionId, result, problems) {
  for (const shot of result.screenshots.slice(0, 3)) {
    const abs = path.isAbsolute(shot) ? shot : path.join(ROOT, shot);
    if (!fs.existsSync(abs)) continue;

    try {
      await client.uploadExecutionAttachment(
        executionId,
        path.basename(abs),
        fs.readFileSync(abs)
      );
    } catch (err) {
      problems.push(`${result.caseIds[0]} screenshot: ${err.message}`);
    }
  }
}

main().catch((err) => {
  // fail() has already printed and just wants us to stop.
  if (err instanceof CleanExit) {
    process.exitCode = 1;
    return;
  }

  // A setup mistake gets its message alone; anything else is a bug and gets the
  // stack, because whoever hits it will need it.
  const message = err.userFacing ? err.message : err.stack || err.message;
  process.stderr.write(`\n  ERROR  ${message}\n\n`);
  process.exitCode = 1;
});
