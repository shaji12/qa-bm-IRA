# BM Canteen Automation

Playwright (JavaScript) automation for **BM Canteen** (Snack Lab). The app has a
separate login for each kind of user — Master Admin, parent, student — and each
one is tested as its own **role**. Master Admin is automated today; parent and
student are next.

If you only need to run tests, [Quick start](#quick-start) is enough.

---

## Contents

- [Quick start](#quick-start)
- [How a run works](#how-a-run-works)
- [Choosing which server you test](#choosing-which-server-you-test)
- [Choosing which tests run](#choosing-which-tests-run)
- [Anatomy of a test](#anatomy-of-a-test)
- [The three rules](#the-three-rules)
- [Project structure](#project-structure)
- [Adding a role](#adding-a-role)
- [How TestLink connects](#how-testlink-connects)
- [Current status](#current-status)
- [Troubleshooting](#troubleshooting)

---

## Quick start

```powershell
npm install
npx playwright install --with-deps

# credentials — ask a teammate for the real values
Copy-Item .env.example .env.qa
notepad .env.qa

npm run test:qa          # run everything against QA
npm run report:qa        # open the HTML report
```

**First run on a new Windows machine?** If `npm` fails with *"running scripts is
disabled on this system"*, see [Troubleshooting](#troubleshooting).

---

## How a run works

Tests never know which server they run against. That comes from configuration,
so the same spec runs against QA or production unchanged.

1. **The command sets the target.** `npm run test:qa` sets `TEST_ENV=qa`. No
   `TEST_ENV` at all also means **qa** — forgetting a flag must never send you
   to production.
2. **Credentials load from the matching file.** `.env.qa` or `.env.prod`. Both
   use the same variable names, so only the values differ.
3. **Playwright projects are generated** from
   [`src/config/environments.js`](src/config/environments.js):

   | Project | Purpose |
   |---|---|
   | `bm_canteen-setup` | Logs in as Master Admin **once** and saves the session |
   | `bm_canteen-ui` | All browser tests, reusing that session |

4. **Setup runs first**, because `bm_canteen-ui` depends on it. If setup cannot
   log in, the UI tests do not run — scroll up for the setup error.
5. **Results are written per instance** to `reports/<instance>/` — the HTML
   report, `results.json` (read by TestLink publishing) and JUnit XML.

Every run prints its target first:

```
  Playwright target instance: QA  (.env.qa)
```

---

## Choosing which server you test

| Command | Reads | What it is |
|---|---|---|
| `npm run test:qa` | `.env.qa` | `canteen-demo.globtech.in`. **The default.** |
| `npm run test:prod` | `.env.prod` | Production — read-only tests only |

Any test tagged `@no-prod` writes real records, so it **skips automatically** on
prod. To override deliberately: `npm run test:prod:unsafe`.

---

## Choosing which tests run

Three tiers, nested:

| Tier | Command (QA) | Selects |
|---|---|---|
| Sanity | `npm run test:qa:sanity` | `@sanity` |
| Functional | `npm run test:qa:functional` | `@sanity` + `@functional` |
| Regression | `npm run test:qa` | everything — no filter |

**Regression is the absence of a filter, not a tag**, so a new test joins it the
moment it exists.

Anything after `--` goes to Playwright:

```powershell
npm run test:qa -- admin-login.spec.js       # one file
npm run test:qa -- -g "TC04"                 # one test
npm run test:qa -- -g "@Canteen-52"          # by TestLink ID
npm run test:qa -- --headed                  # watch it run
npm run test:qa -- --ui                      # interactive mode
npm run list                                 # what WOULD run
npm run codegen                              # record clicks as code
```

---

## Anatomy of a test

```js
const { test, expect } = require('../../../../../core/fixtures/test-fixtures');
const { AdminLoginPage } = require('../../../pages/common/AdminLoginPage');

test('TC01 — Master Admin logs in with valid credentials @Canteen-52',
     { tag: ['@sanity'] }, async ({ page, env }) => {
  const admin = env.roles.admin;
  const login = new AdminLoginPage(page, admin.url);

  await test.step('Open the admin login page', async () => {
    await login.goto();
  });
  ...
});
```

| Piece | Why |
|---|---|
| `require(... test-fixtures)` | **Not** `@playwright/test`. This is what gives you `env`. |
| `{ tag: ['@sanity'] }` | The tier. Omit it for regression-only tests. |
| `@Canteen-52` in the title | The TestLink case ID — see [below](#how-testlink-connects) |
| `env.roles.admin` | The role's login URL and credentials for the current instance |
| `new AdminLoginPage(page, admin.url)` | Locators live in Page Objects, never in specs |
| `test.step(...)` | A failure says *which* step broke |

Page Objects extend [`BasePage`](src/core/base-page.js) (`goto`, `click`, `fill`,
`waitForVisible`, `textOf`, `isVisible` — each waits for the element first).
Prefer `getByRole` / `getByLabel` over CSS or XPath.

**Codegen output is a starting point, not a finished locator.** Two examples
from the admin login: the eye icon was recorded as
`getByRole('button').filter({ hasText: /^$/ })`, which also matches a toast's
close button; and `name: 'Close'` also matches "Close toast". Both are fixed in
[AdminLoginPage.js](src/projects/bm_canteen/pages/common/AdminLoginPage.js).

---

## The three rules

**1. Import `test`/`expect` from `core/fixtures/test-fixtures`**, never from
`@playwright/test`.

**2. Never log in inside a test** — `auth.setup.js` does it once per run. The
exception is a spec where logging in *is* the test; it opts out explicitly:

```js
test.use({ storageState: { cookies: [], origins: [] } });
```

**3. Never commit credentials.** They live in `.env.<instance>` (gitignored).
`.env.example` is the committed template — placeholders only.

---

## Project structure

```
├── playwright.config.js          generates all projects from config
├── .env.qa / .env.prod           credentials (gitignored)
├── .env.example                  the committed template
│
├── src/
│   ├── config/environments.js    ⭐ instances, the product, its roles
│   ├── core/                     shared framework — rarely edited
│   │   ├── base-page.js
│   │   ├── constants/paths.js    .auth file naming
│   │   ├── fixtures/test-fixtures.js   the `env` fixture + production guard
│   │   └── testlink/             TestLink XML-RPC client and result mapping
│   └── projects/bm_canteen/
│       ├── auth.setup.js         logs in as Master Admin once per run
│       ├── data/
│       │   └── users.js          login test data and expected messages
│       ├── pages/
│       │   └── common/           used across every module:
│       │                         AdminLoginPage, AdminDashboardPage
│       └── tests/ui/
│           └── login/            admin-login.spec.js
│
└── scripts/run-assigned.js       `npm run testlink`
```

The same layout as the Loyaltri framework. Each new module of the app gets the
same three pieces, named after the module:

| Piece | Where | Example for Stock Management |
|---|---|---|
| Page Objects | `pages/<module>/` | `pages/stock/StockPage.js` |
| Test data | `data/<module>.js` | `data/stock.js` |
| Specs | `tests/ui/<module>/` | `tests/ui/stock/stock.spec.js` |

`pages/common/` is only for pages every module relies on — login, the
dashboard, and later the sidebar navigation. Tiers (`@sanity`, `@functional`)
are tags, never folders.

---

## Adding a role

Parent and student each sign in on their own page. To add one (parent shown):

1. Uncomment `parent` under `roles` in
   [`environments.js`](src/config/environments.js)
2. Add `BM_CANTEEN_PARENT_URL` / `_USER` / `_PASS` to `.env.qa`, `.env.prod`
   and `.env.example`
3. Add `ParentLoginPage.js` to `pages/common/`, its data to `data/users.js`,
   and `tests/ui/login/parent-login.spec.js`
4. In specs, use `env.roles.parent`

---

## How TestLink connects

The TestLink case ID goes in the test title as a tag:

```js
test('TC01 — Master Admin logs in with valid credentials @Canteen-52', ...)
```

It both **selects** the test (`-g "@Canteen-52"`) and **addresses** the result.
There is no mapping file. The project's prefix is `Canteen` — the tag must match TestLink's case exactly.

### Writing a new automated case

1. Write the case in TestLink first
2. Note the ID TestLink assigns (`Canteen-63`) — never invent it
3. Put it in the spec title as `@Canteen-63`
4. `npm run list` to confirm it's discovered

### Running your assigned cases

```powershell
npm run testlink -- --build "Sprint-1"
npm run testlink:dry -- --build "Sprint-1"      # run tests, post nothing
npm run testlink -- --help
```

Set up once in `.env` (the **shared** file): `TESTLINK_URL`, your own
`TESTLINK_KEY` (My Settings → Generate a new API key), `TESTLINK_LOGIN`,
`TESTLINK_PROJECT`, `TESTLINK_PLAN`. **Use your own key** — TestLink stamps each
execution with the key's owner.

| Playwright | TestLink |
|---|---|
| passed | Passed |
| failed / timed out | Failed — error and screenshot attached |
| skipped | **Blocked** — it never ran, which is not a pass |

---

## Current status

| Item | State |
|---|---|
| Master Admin login suite | 11 tests (TC01–TC11), tagged `@Canteen-52` … `@Canteen-62` |
| Parent and student login | Not automated. TestLink cases `Canteen-5`, `-8`, `-10` exist |
| Session reuse | ⚠️ **Does not carry over yet.** BM keeps its login token in `sessionStorage` (`accessToken`, `user`), which Playwright's `storageState` does not save. Every current test logs in itself, so nothing is affected today; the first dashboard test will need this solved |
| CI | Needs the `BM_CANTEEN_*` secrets added in GitHub → Settings → Secrets and variables → Actions |
| API testing | Not built |

---

## Troubleshooting

**`npm : ... npm.ps1 cannot be loaded because running scripts is disabled`**
Windows' execution policy, not this repo. Fix once per user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

Don't omit `-Force`: without it, answering the prompt wrongly writes nothing and
prints no error. `npm.cmd run test:qa` works without changing any policy.

**`EPIPE: broken pipe` with a `--grep` containing `|`**
Use the npm script (`npm run test:qa:functional`). Typed by hand in PowerShell,
cmd.exe reads the `|` as a pipe and tears the grep apart.

**`Unknown TEST_ENV "alpha"`** — only `qa` and `prod` exist.

**`Missing BM_CANTEEN_ADMIN_PASS for the "qa" instance`** — that `.env` file is
missing the variable. The message names every missing variable and the file.

**Every UI test is skipped or fails at once** — `auth.setup.js` could not log
in. Scroll up; the real error is there. Usually the admin credentials in
`.env.qa` are wrong.

**My new test doesn't run** — `npm run list`. Specs must be under `tests/ui/`
and end in `.spec.js`.
