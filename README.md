# QA Automation Framework

Playwright (JavaScript) automation for testing multiple external products from
one repository. **Loyaltri** is the first product; others get added alongside it.

This README is written to be read start-to-finish by someone who has never seen
the framework. If you only need to run tests, [Quick start](#quick-start) is
enough.

---

## Contents

- [Quick start](#quick-start)
- [The one-paragraph explanation](#the-one-paragraph-explanation)
- [What happens when you run a test](#what-happens-when-you-run-a-test)
- [Choosing which server you test](#choosing-which-server-you-test)
- [Choosing which tests run](#choosing-which-tests-run)
- [Anatomy of a test](#anatomy-of-a-test)
- [The three rules](#the-three-rules)
- [Project structure](#project-structure)
- [How TestLink connects](#how-testlink-connects)
- [Adding a new product](#adding-a-new-product)
- [Current status](#current-status)
- [Troubleshooting](#troubleshooting)

---

## Quick start

```powershell
npm install
npx playwright install --with-deps

# credentials — ask a teammate for the real values
Copy-Item .env.example .env.alpha
notepad .env.alpha

npm run test:alpha          # run everything against alpha
npm run report              # open the HTML report
```

If that works, you're set up. Everything below explains why it works.

---

## The one-paragraph explanation

You write tests once. They don't know which server they're running against, and
they don't know which product they belong to. Both of those come from
**configuration**, resolved at startup. That's the whole design. It means the
same `login.spec.js` runs against alpha, staging or production without a single
character changing, and adding a second product costs one line of config rather
than a parallel copy of the framework.

---

## What happens when you run a test

Walk through `npm run test:alpha` step by step. Understanding this sequence is
most of understanding the framework.

### 1. The command sets the target

```json
"test:alpha": "cross-env TEST_ENV=alpha playwright test"
```

`TEST_ENV` is the only thing that decides which server gets tested.

### 2. Config resolves the instance

[`src/config/environments.js`](src/config/environments.js) reads it:

```js
const INSTANCE = String(process.env.TEST_ENV || 'alpha').toLowerCase();
```

No `TEST_ENV`? You get **alpha** — the throwaway box. That default is
deliberate: forgetting a flag should never be the reason you hit production.

A wrong name stops the run immediately rather than failing confusingly later:

```
Error: Unknown TEST_ENV "qa". Use one of: alpha, staging, prod
```

### 3. Credentials load from the matching file

```js
require('dotenv').config({ path: `.env.${INSTANCE}` });   // .env.alpha
```

The instance name **is** the filename. And every `.env` file uses identical
variable names — `LOYALTRI_URL`, `LOYALTRI_USER`, `LOYALTRI_PASS` — so only the
*values* differ between environments. That's precisely why no test needs to know
where it's running.

### 4. Playwright projects get generated

[`playwright.config.js`](playwright.config.js) asks config which products exist,
and builds two projects for each:

| Project | Purpose |
|---|---|
| `loyaltri-setup` | Logs in through the real UI **once**, saves the session |
| `loyaltri-ui` | All browser tests, reusing that saved session |

You never edit this file to add a product — it reads the list from config.

### 5. Setup logs in once

[`auth.setup.js`](src/projects/loyaltri/auth.setup.js) signs in for real and
saves the browser session to `.auth/loyaltri-alpha.json`.

The instance is in the filename on purpose. Without it, a staging run would
silently reuse an alpha session — testing the wrong server while reporting green.

### 6. Tests run against that session

`loyaltri-ui` declares `dependencies: ['loyaltri-setup']`, so setup always runs
first. Every test starts already logged in. **One login per run, not per test.**

### 7. Results are written per instance

```
reports/alpha/html-report/       human-readable report
reports/alpha/results.json       machine-readable (TestLink will read this)
reports/alpha/junit-results.xml
```

Scoped by instance so a staging run never overwrites the alpha results you were
about to read.

---

## Choosing which server you test

Three instances. Every run prints its target before doing anything, because the
most expensive mistake here is not knowing which server you just tested:

```
  Playwright target instance: ALPHA  (.env.alpha)
```

| Command | Reads | What it is |
|---|---|---|
| `npm run test:alpha` | `.env.alpha` | Throwaway test box. **The default.** |
| `npm run test:staging` | `.env.staging` | Pre-release |
| `npm run test:prod` | `.env.prod` | Production — read-only tests only |

### The production guard

Any test tagged `@no-prod` writes real records. Against production that means
real rows nobody cleans up, so those tests **skip automatically** on prod:

```js
test('Creates an employee @no-prod', ...)   // skipped when TEST_ENV=prod
```

Read-only tests still run, which keeps production useful for smoke checks. To
override deliberately: `npm run test:prod:unsafe`.

---

## Choosing which tests run

Two independent filters that combine freely.

**By project** — which product:

```powershell
npx playwright test --project=loyaltri-ui
```

**By tag** — how deep the run goes:

```powershell
npm run test:smoke                        # @smoke
npm run test:regression                   # @regression
npx playwright test --grep "@LOYTRI-37"   # one specific TestLink case
```

Together:

```powershell
npm run test:alpha -- --grep "@smoke" --project=loyaltri-ui --headed
```

### Useful flags

| Flag | Does |
|---|---|
| `--headed` | Watch it in a real browser |
| `--debug` | Step through line by line |
| `--ui` | Playwright's interactive mode |
| `npm run list` | Show what *would* run, without running it |
| `npm run codegen` | Record a test by clicking through the app |

`npm run list` is the fastest way to check a new test is being picked up.

---

## Anatomy of a test

```js
const { test, expect } = require('../../../../../core/fixtures/test-fixtures');
const { LoginPage } = require('../../../pages/LoginPage');

test.describe('Loyaltri login @smoke', () => {
  test('TC01 — Successful login with valid credentials @LOYTRI-37', async ({ page, env }) => {
    const login = new LoginPage(page);

    await test.step('Open the login page', async () => {
      await login.goto();
    });

    await test.step('Enter valid credentials', async () => {
      await login.login(env.username, env.password);
    });

    await test.step('The session is live', async () => {
      await expect(login.accountMenu).toBeVisible({ timeout: 30000 });
    });
  });
});
```

Reading it piece by piece:

| Piece | Why |
|---|---|
| `require(... test-fixtures)` | **Not** `@playwright/test`. This is what gives you `env`. |
| `@smoke` on the describe | Every test inside inherits the tag |
| `@LOYTRI-37` in the title | The TestLink case ID — see [below](#how-testlink-connects) |
| `{ page, env }` | `env` is the current instance's URL/credentials, injected automatically |
| `new LoginPage(page)` | All locators live in Page Objects, never in specs |
| `test.step(...)` | Named steps appear in the report, so a failure says *which* step broke |
| `login.goto()` | Relative navigation — the host comes from `baseURL` |

### Page Objects

Every page class extends [`BasePage`](src/core/base-page.js), which provides
`goto`, `click`, `fill`, `waitForVisible`, `textOf`, `isVisible` and friends —
all of which wait for the element before acting, so you rarely need explicit
waits.

Locators are declared in the constructor:

```js
class LoginPage extends BasePage {
  constructor(page) {
    super(page, '/');
    this.emailInput = page.getByRole('textbox', { name: 'Email Address' });
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
  }
}
```

Prefer `getByRole`, `getByLabel`, `getByTestId` over CSS or XPath — they survive
redesigns far better.

### Test data

- **Non-secret fixtures** → [`data/users.js`](src/projects/loyaltri/data/users.js)
  (expected messages, invalid credentials, the reset-flow address)
- **Credentials** → `.env.<instance>` only, reached via the `env` fixture. Never
  in a spec.

The framework carries **only what the suite actually uses**. `BasePage` has six
methods, not twenty; there is no random-data utility. When a test needs
something new, add it then — not in anticipation.

---

## The three rules

Everything else is a preference. These three actually matter:

**1. Import `test`/`expect` from `core/fixtures/test-fixtures`, never from
`@playwright/test`.** That import is what gives you the `env` fixture and the
production guard. Get it wrong and your test hardcodes an environment.

**2. Never log in inside a test.** `auth.setup.js` does it once per run. The only
exception is `login.spec.js`, which opts out explicitly:

```js
test.use({ storageState: { cookies: [], origins: [] } });
```

**3. Never commit credentials.** They live in `.env.<instance>`, which is
gitignored — as is `.auth/`, which holds live session tokens.

---

## Project structure

```
├── playwright.config.js          generates all projects from config
├── .env.alpha / .env.staging / .env.prod    credentials (gitignored)
├── .env.example                  the committed template
├── .auth/                        saved sessions (gitignored)
├── reports/<instance>/           results (gitignored)
│
├── src/
│   ├── config/
│   │   └── environments.js       ⭐ single source of truth: which products exist
│   │
│   ├── core/                     shared framework — rarely edited
│   │   ├── base-page.js          BasePage every Page Object extends
│   │   ├── constants/paths.js    .auth file naming
│   │   ├── fixtures/
│   │   │   └── test-fixtures.js  the `env` fixture + production guard
│   │   └── testlink/
│   │       ├── config.js         reads TESTLINK_* from .env
│   │       ├── xmlrpc.js         XML-RPC codec (no dependencies)
│   │       ├── client.js         the TestLink API calls
│   │       └── results.js        Playwright results → TestLink format
│   │
│   └── projects/
│       └── loyaltri/
│           ├── auth.setup.js     logs in once per run
│           ├── pages/            Page Object Models
│           ├── data/             non-secret fixtures
│           └── tests/ui/smoke/   the specs
│
├── scripts/
│   └── run-assigned.js           `npm run testlink` — the tester's command
│
└── testlink/
    └── Convert-ToTestLink.ps1    converts case XML for TestLink import
```

### Who edits what

| Layer | How often |
|---|---|
| `core/` | Almost never. Changes here affect every product — flag for extra review. |
| `config/environments.js` | Once per new product |
| `projects/<key>/pages/` | When the app's UI changes |
| `projects/<key>/tests/` | Every day |

A tester running assigned tests edits **none** of these.

---

## How TestLink connects

One tag in the test title does two jobs:

```js
test('TC01 — Successful login with valid credentials @LOYTRI-37', ...)
```

- **Selection** — `--grep "@LOYTRI-37"` runs exactly that test
- **Addressing** — the result knows which TestLink case to report against

There is no mapping file to maintain, because a mapping file drifts and a tag in
the title cannot.

### Writing a new automated case

1. **Write the case in TestLink first**, as a manual case with proper steps
2. Note the **external ID** TestLink assigns (`LOYTRI-52`) — you never invent it
3. Write the spec, putting that ID in the title as a tag
4. `npm run list` to confirm it's discovered

### Status mapping

| Playwright | TestLink | Why |
|---|---|---|
| passed | Passed (`p`) | |
| failed / timedOut | Failed (`f`) | Error and screenshot go into the notes |
| skipped | **Blocked** (`b`) | It never ran — which is not the same as passing |

Only the **final attempt** counts. A test that fails then passes on retry is a
pass, but the retry count is kept so notes can flag it as flaky.

### Test Plans and Builds — the part people miss

A test case is a *template*. You never execute it directly. You execute it inside
a **Build**, inside a **Test Plan** — and that is the only place an assignment
can exist.

| Level | What it is | How often |
|---|---|---|
| Test Project | Loyaltri | Once, ever |
| Test Suite | Login Test, Onboarding — where cases are written | Per feature area |
| Test Plan | A chosen subset for one round of testing | Per cycle |
| Build | What you execute against; results attach here | Per deployment |
| Assignment | Case → tester, inside a Build | Per cycle |

Setup path: *Test Plan Management → Create*, then *Add / Remove Test Cases*,
then *Builds/Releases → Create*, then *Assign Test Case Execution*. Each tester
generates their own key under *My Settings → Generate a new API key*, so TestLink
records who really ran what.

### Running your assigned cases

One command runs everything assigned to you and publishes the results back:

```powershell
npm run testlink -- --build "Sprint-24-RC1"
```

Set up once, in `.env` (the **shared** file — one TestLink server serves every
app instance, so these don't change when `TEST_ENV` does):

```bash
TESTLINK_URL=https://testlink.loyaltri.in
TESTLINK_KEY=<your own key — My Settings → Generate a new API key>
TESTLINK_LOGIN=<your TestLink username>
TESTLINK_PROJECT=Loyaltri
TESTLINK_PLAN=Regression Sprint 24
```

**Use your own key.** TestLink stamps each execution with the key's owner, so a
shared key destroys the record of who actually ran what.

| Value | Changes | Where |
|---|---|---|
| URL, key, login, project | Rarely / per person | `.env` |
| Plan | Per cycle | `.env`, override with `--plan` |
| **Build** | **Per deployment** | **`--build` flag** |

Options:

```powershell
npm run testlink -- --build "RC1" --suite "Login Test"   # narrow to one suite
npm run testlink -- --build "RC1" --plan "Hotfix Round"  # override the .env plan
npm run testlink -- --build "RC1" --all                  # every case in the plan
npm run testlink:dry -- --build "RC1"                    # run tests, post nothing
npm run testlink -- --help
```

Which server the tests run against still comes from `TEST_ENV`, exactly as
normal — `npm run testlink` targets alpha unless you say otherwise.

### What it does

```
1. Read .env                    URL, key, login, project, plan
2. Resolve names → IDs          getProjects → getProjectTestPlans → getBuildsForTestPlan
3. Fetch your assignment        getTestCasesForTestPlan, filtered to your user
4. Build a grep                 "@LOYTRI-37\b|@LOYTRI-40\b"
5. Run Playwright               against TEST_ENV's instance
6. Parse results.json           status, duration, error, screenshots
7. Post each result             reportTCResult + screenshot on failure
8. Report coverage gaps         assigned cases with no spec
```

Step 8 is the quiet win: every run tells you exactly which assigned cases have
no automated test yet.

---

## Adding a new product

1. Add the key to [`src/config/environments.js`](src/config/environments.js):

   ```js
   montes: {
     displayName: 'Montes',
     instance: INSTANCE,
     baseURL: process.env.MONTES_URL,
     username: process.env.MONTES_USER,
     password: process.env.MONTES_PASS,
   },
   ```

2. Add `MONTES_URL` / `_USER` / `_PASS` to every `.env.<instance>` **and**
   `.env.example`
3. Create `src/projects/montes/` with `auth.setup.js`, `pages/`, `tests/ui/`
4. Add `montes` to the CI matrix in `.github/workflows/playwright.yml`
5. Add the secrets in GitHub → Settings → Secrets and variables → Actions

`playwright.config.js` needs no edit.

**Two constraints:** the key must not end in `-setup` or `-ui` (those suffixes
get stripped), and tests must live in `tests/ui/` — that's the only directory
scanned.

---

## Current status

Honest state of things, so nobody is surprised.

### Working

| Capability | Notes |
|---|---|
| Three-instance switching | alpha / staging / prod, verified |
| Login suite | 15 cases, `LOYTRI-37`…`LOYTRI-51` |
| Dashboard smoke | 1 case |
| Session reuse | One login per run |
| Production guard | Verified in both directions |
| TestLink ID tagging | Every spec tagged |
| Result parsing | `results.js` — status, duration, error, screenshots |
| Coverage gap detection | Assigned cases with no spec are reported |
| **TestLink API** | ✅ **Fixed and live.** `tl.sayHello` / `tl.about` respond. |
| **TestLink client** | `xmlrpc.js` + `client.js` — zero dependencies, 8/8 codec tests, verified against the live server |
| **`npm run testlink`** | Verified end-to-end in dry-run: resolved `Loyaltri` / `Regression sprint 1` / `regression sprint-1`, ran all 15 cases, mapped every result to its `LOYTRI-nn` id |

**Total: 17 tests across 3 files, 2 Playwright projects.**

### Not working / not built

| Item | State |
|---|---|
| **Publishing results** | ⏳ Verified as far as `--dry-run`: 15/15 cases fetched, run and mapped correctly against plan `Regression sprint 1`. The `reportTCResult` write itself has not been exercised yet. |
| **Per-tester filtering** | ⚠️ **Not available on this server.** TestLink 1.9.20's `getTestCasesForTestPlan` returns no assignee field at all — verified across `details=full` and `buildid` variants. Until cases are actually assigned, every run covers the whole plan and prints a note saying so. |
| **CI workflow** | ⚠️ **Broken.** [playwright.yml:35](.github/workflows/playwright.yml#L35) runs `--project=<key>-api`, which no longer exists. It also never sets `TEST_ENV`. |
| **API testing** | Removed deliberately, to be rebuilt. See below. |
| **`.env.staging`** | Blank — `npm run test:staging` stops at the credentials check until filled in. |
| **Version control** | Not a git repository. No history, no undo. |

### Rebuilding API testing

Removed on purpose — the previous attempt targeted a REST API that doesn't
exist. A rebuild restores four things: an HTTP client in `src/core/`, an
`apiClient` fixture, a `<key>-api` project in `playwright.config.js`, and
`apiURL` in config plus `<KEY>_API_URL` in each `.env`.

**What was already established — don't rediscover it:**

- The API is on its **own subdomain**: `alpha-api.loyaltri.com` (`13.202.147.154`)
  is a different server from `alpha.loyaltri.com` (`13.201.164.185`)
- It is **RPC over a single endpoint**, not REST. Every call is
  `POST /api/main` with `{ action, method, kwargs }`. Unauthenticated returns
  **401**, confirming the path exists
- Auth is a **Bearer JWT, 30-minute expiry**; the subject claim is `userName`
- The **login action's name and response shape were never captured** — that's
  the first thing a rebuild needs, from DevTools → Network on the login page
- `auth.setup.js` produces a *browser* storageState, **not** an API token

---

## Troubleshooting

**`Unknown TEST_ENV "qa"`**
Only `alpha`, `staging`, `prod` exist. Use `npm run test:alpha`.

**`Missing LOYALTRI_USER and LOYALTRI_PASS for the "staging" instance`**
That `.env` file is empty. Copy `.env.example` to `.env.staging` and fill it in.
The message always names the exact variables and file.

**Every UI test fails at once**
`auth.setup.js` failed, so no session was saved. Scroll up — the real error is
there. If none of them could log in, none of them could have passed anyway.

**A test passes locally but fails in CI**
Check viewport. Playwright's default is 1280×720; this framework uses 1920×1080
because Loyaltri's navigation rail collapses below the `lg` breakpoint and
disappears from every test.

**My new test doesn't run**
`npm run list`. If it's not listed, it's in the wrong folder — specs must be
under `tests/ui/` and end in `.spec.js`.

**Tests are slow / time out on first load**
Alpha is shared and slow; cold start has been measured over 30s under parallel
load. Timeouts are already generous (120s test, 60s navigation). One local retry
absorbs cold starts, and retried tests are reported as *flaky*, not hidden.

**Which server did I just test?**
Every run prints it in the first line of output.

---

## Keeping this document current

This README is the framework's onboarding doc. When something changes, update the
matching section:

| Change | Update |
|---|---|
| New instance | [Choosing which server](#choosing-which-server-you-test), Quick start |
| New product | [Project structure](#project-structure), [Current status](#current-status) |
| New core fixture | [Anatomy of a test](#anatomy-of-a-test), [The three rules](#the-three-rules) |
| TestLink publishing built | [How TestLink connects](#how-testlink-connects), [Current status](#current-status) |
| API testing rebuilt | [Rebuilding API testing](#rebuilding-api-testing), structure |
| A confusing error hit twice | [Troubleshooting](#troubleshooting) |
