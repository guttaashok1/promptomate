# 🤖 Promptomate

**Playwright tests written in English. Self-heal when the UI changes. CI that tells you which red tests are real bugs.**

[![npm version](https://img.shields.io/npm/v/promptomate.svg)](https://www.npmjs.com/package/promptomate)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/guttaashok1/promptomate?style=social)](https://github.com/guttaashok1/promptomate)
[![CI](https://github.com/guttaashok1/promptomate/actions/workflows/promptomate.yml/badge.svg)](https://github.com/guttaashok1/promptomate/actions)

<!-- Demo GIF placeholder — replace with actual recording:
https://github.com/guttaashok1/promptomate/assets/...
-->

```bash
npm install -g promptomate
promptomate explore "log in, add a backpack to cart, verify badge shows 1" \
  --url https://www.saucedemo.com
```

Claude clicks through your site, confirms the flow works, and writes a standalone Playwright spec — typically in under a minute. When the UI changes, run `promptomate triage --apply` and it heals the locators itself. In CI, failing tests get classified as **real bug** / **flake** / **DOM drift** so your team knows what to look at.

## Why another testing tool?

| | Tosca | Cypress | Playwright | Testim | Mabl | **Promptomate** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Open source | ❌ | ✅ | ✅ | ❌ | ❌ | **✅ MIT** |
| Write tests in English | ❌ | ❌ | ❌ | ⚠️ no-code | ⚠️ no-code | **✅** |
| Self-healing locators | ❌ | ❌ | ❌ | ✅ | ✅ | **✅** |
| AI failure triage | ❌ | ❌ | ❌ | ⚠️ partial | ⚠️ partial | **✅** |
| Visual assertions (AI-judged) | ❌ | ❌ | ❌ | ⚠️ snapshots | ⚠️ snapshots | **✅** |
| Human-editable code output | ❌ drag-drop | ✅ | ✅ | ⚠️ limited | ⚠️ limited | **✅ TypeScript** |
| Local-first / BYO API key | ❌ | ⚠️ cloud | ✅ | ❌ cloud only | ❌ cloud only | **✅** |
| CI PR comments with diagnosis | ❌ | ⚠️ basic | ⚠️ basic | ✅ | ✅ | **✅ + heal patch** |
| Free tier | ❌ | ✅ limited | ✅ full | ❌ | ❌ | **✅ forever** |
| Pricing (team of 10) | $50k+/yr | $0–$900/mo | Free | $5k+/mo | $5k+/mo | **$0 (BYO key)** |

The wedge: **Promptomate is the only tool sitting at the intersection of open-source, AI-powered, and local-first.** Testim and Mabl are the closest in capability but require proprietary cloud, seat licensing, and data going out to their servers. Vanilla Playwright / Cypress have no AI at all.

## Who it's for

- **QA engineers** tired of rewriting locators after every UI change
- **Product managers & designers** who want to protect critical flows without waiting for engineering
- **Small eng teams** adding tests to products where formal QA doesn't exist
- **Anyone running Playwright** who wants self-healing and smarter CI

## Install (3 commands)

```bash
npm install -g promptomate
promptomate init                      # scaffolds .env, playwright.config.ts, tests/, .promptomate/
# add ANTHROPIC_API_KEY to the .env it creates
promptomate explore "log in and see dashboard" --url https://your-app.com
```

> You'll need an [Anthropic API key](https://console.anthropic.com/settings/keys). Bring-your-own — Promptomate never handles billing.

## Core commands

| Command | What it does |
|---|---|
| `init` | Scaffold a fresh project in the current directory |
| `gen <prompt>` | One-shot generation from a single page snapshot |
| `explore <prompt>` | Agent-driven: clicks through the site, handles multi-step flows |
| `refine <name> <instruction>` | Tweak an existing spec with natural language |
| `heal <name>` | Re-resolve drifted locators against current DOM |
| `triage <name>` | Classify a failing test: real bug / flake / DOM drift |
| `triage <name> --apply` | Auto-heal or retry based on the verdict, stop on real bugs |
| `ci` | Run every saved test through auto-triage, emit markdown report |
| `run <name>` / `list` | Execute a saved test / list all of them |
| `serve` | Start the web UI at `localhost:3535` |

Every command that calls the API prints a cost line at the end:

```
3 API calls · 8,412 in + 1,203 out · $0.0720 · claude-opus-4-7 ×3
```

## Web UI

```bash
promptomate serve
# open http://localhost:3535
```

Point-and-click interface for non-technical users. Live stream of the agent's tool calls, generated spec preview, **Run / Refine / Triage / View** buttons per saved test. Last-run status + pass/fail + output visible inline.

## Drop-in GitHub Action

Auto-triage every PR. One comment per test with verdict; healed specs get a ready-to-`git apply` diff patch in the comment.

```yaml
# .github/workflows/promptomate.yml in your repo
name: Promptomate
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: guttaashok1/promptomate@main
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          # optional:
          model: sonnet
          max-attempts: "3"
```

Inputs: `anthropic-api-key` (required), `model` (`opus`/`sonnet`/`haiku`), `max-attempts`, `tests-dir`, `metadata-dir`.

## Key features

### 🧭 MCP-backed exploration
`explore` spawns Microsoft's official [Playwright MCP server](https://github.com/microsoft/playwright-mcp) as a subprocess. Claude gets `browser_navigate`, `browser_click`, `browser_hover`, `browser_drag`, `browser_type`, `browser_fill_form`, `browser_screenshot`, `browser_file_upload`, `browser_network_requests`, `browser_console_messages`, and more. It recovers from failed clicks, handles multi-page flows, and writes a standalone spec that uses regular Playwright locators (not MCP refs).

### 🩹 Self-healing locators
`heal` captures a fresh ARIA snapshot of the page and regenerates only the parts of the spec that changed. `triage --apply` runs this automatically when it diagnoses drift.

### 🔎 AI failure triage
Given the test code, Playwright's error output, a fresh ARIA snapshot, and a screenshot, Claude classifies failures as:
- **`real_bug`** — the feature is actually broken (stops the PR with exit code 2)
- **`flake`** — transient/network/timing issue (retries with a short pause)
- **`dom_drift`** — UI changed, locators need updating (runs `heal` automatically)

### 👁️ Visual assertions
For checks the DOM can't express:

```ts
await expectVisual(page, "a red error banner above the Login button");
await expectVisual(page.getByRole("figure"), "a rendered image of a shoe, not a broken-image placeholder");
```

Claude Vision judges the screenshot. Throws on fail. One API call per assertion (~$0.01, ~1s).

### 🔐 Secrets via `${VARNAME}`

```bash
# .env (gitignored)
SAUCE_PASSWORD=secret_sauce

# prompt
promptomate explore "log in with password \${SAUCE_PASSWORD}" --url https://app.example.com
```

- Substituted at tool-dispatch time so the agent drives a logged-in browser
- Scrubbed from tool results so the value doesn't round-trip through the model
- Generated spec uses `process.env.SAUCE_PASSWORD ?? ""` — **never** inlined
- Metadata stores the placeholder template — safe to commit

### 🔑 Auth fixtures (login once, reuse across tests)

```bash
# Setup: produces .promptomate/auth/sauce-user.json
promptomate explore "log in as standard_user with \${SAUCE_PASSWORD}" \
  --url https://www.saucedemo.com --auth sauce-user

# Consumers: skip the login flow entirely
promptomate explore "add backpack to cart" \
  --url https://www.saucedemo.com/inventory.html --use-auth sauce-user
```

The generated consumer spec opens with `test.use({ storageState: ".promptomate/auth/sauce-user.json" })`. Playwright applies the saved session automatically. `ci` runs auth fixtures serially first, then fans out dependents in parallel.

### 💸 Cost-aware by default
- Every command prints a per-run cost summary (tokens in/out, dollars, model breakdown)
- `-m, --model <opus|sonnet|haiku|full-id>` on every command — downshift for cost control
- Cache read (×0.1) and cache write (×1.25) pricing factored in

### 🏷️ Organize + filter
- Tag tests: `gen/explore -t smoke -t critical`
- Run subsets: `ci -t smoke`
- Run only changed tests in CI: `ci --changed --base origin/main`
- Parallel execution: `ci --concurrency 4`

### 🧪 Auto-triage in CI comments
The included GitHub Action posts a single comment per PR:

```
🤖 Promptomate Test Report
✅ 8 passed · 🩹 1 auto-healed · 🐛 1 real bug

| Test             | Status           | Details                          |
| user-login       | ✅ passed        |                                   |
| add-to-cart      | 🩹 auto-healed   | Button "Add" renamed to "Buy"    |
| checkout-flow    | 🐛 real bug      | Cart total shows $64 (expected $32) |
```

When auto-heal fires, the comment also includes a `git diff` patch you can `git apply` locally.

## Deploy the web UI

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

The repo ships with `render.yaml`. One-click Blueprint:

1. https://dashboard.render.com/ → **New → Blueprint** → pick this repo
2. Fill in two secrets: `ANTHROPIC_API_KEY` + `PROMPTOMATE_AUTH_TOKEN` (password you invent)
3. Apply — first build takes ~5 min (Chromium install)
4. Open the URL → Basic auth prompt → any username + your token as password

Free tier caveats: sleeps after 15 min idle, 512 MB RAM (fine for `run`/`triage`; heavy `explore` may OOM), ephemeral fs (saved tests in git survive). Bump to Render Starter ($7/mo) or Fly.io (free with persistent volumes) for serious use.

## Architecture

- **CLI** (TypeScript) — all 10 commands, ~2k LoC
- **Claude Opus 4.7** by default (override with `--model sonnet` or `haiku`)
- **Playwright MCP** as a subprocess for agentic browser control
- **Express + static HTML + SSE** for the web UI (no framework)
- **Postgres/Prisma** coming in Phase 3 (multi-tenant cloud tier)

See [CLAUDE.md](CLAUDE.md) for a full source-tree map and conventions.

## Project & roadmap

- **[Roadmap board](https://github.com/users/guttaashok1/projects/2)** — all open work, organized by phase
- **[PLAN.md](PLAN.md)** — living GTM + product plan (intent, marketing, sales, revenue, support, UX, analytics)
- **[Milestones](https://github.com/guttaashok1/promptomate/milestones)** — target dates for each phase
- **[Open issues](https://github.com/guttaashok1/promptomate/issues)** — grab one labelled `good first issue` (coming soon)

## Community & support

- 🐛 [Report a bug](https://github.com/guttaashok1/promptomate/issues/new)
- 💡 [Request a feature](https://github.com/guttaashok1/promptomate/issues/new)
- 📖 [Read CLAUDE.md](CLAUDE.md) — conventions for contributing
- 🤝 [Contributing guide](CONTRIBUTING.md)
- 📜 [Code of Conduct](CODE_OF_CONDUCT.md)

## Contributing

PRs welcome. Short version: fork, `npm install`, `npm run test:unit` (44 tests, ~135ms), write your change, open a PR. Full details in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — free forever for personal and commercial use.

---

Built with [Claude](https://claude.com) and [Playwright](https://playwright.dev). The [Anthropic Agent SDK](https://github.com/anthropics/anthropic-sdk-typescript) powers the agentic exploration; [Microsoft's Playwright MCP](https://github.com/microsoft/playwright-mcp) exposes the browser.
