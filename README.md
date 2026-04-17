# Promptomate

Prompt-driven Playwright test generation. Write UI tests in English; Promptomate generates Playwright specs using semantic locators, runs them, and heals broken locators when the DOM drifts.

## Why

Tosca gives you drag-and-drop but no AI. Playwright gives you code but no AI. Promptomate adds a Claude-powered agent layer on top of Playwright so non-engineers can describe tests in prose and engineers can still edit the generated TypeScript.

## Install

```bash
npm install
npx playwright install chromium
cp .env.example .env   # add your ANTHROPIC_API_KEY
```

## Usage

**Single-shot generation** — looks at the landing page once, writes the spec, runs it:

```bash
npm run dev -- gen "login with valid creds redirects to dashboard" --url https://app.example.com
```

**Agent-driven exploration** — Claude actually clicks through the site to discover the flow, then writes the spec from what it learned:

```bash
npm run dev -- explore "sign up with new email and land on the dashboard" --url https://app.example.com
# --headed flag to watch the browser
```

List saved tests:

```bash
npm run dev -- list
```

Re-run a saved test:

```bash
npm run dev -- run <name>
```

Heal a broken test after DOM drift:

```bash
npm run dev -- heal <name>
```

Refine an existing test with a natural-language instruction:

```bash
npm run dev -- refine <name> "also verify the cart badge shows 1"
npm run dev -- refine <name> "remove the menu button assertion"
```

Triage a failure — classify as real bug / flake / DOM drift and suggest a fix:

```bash
npm run dev -- triage <name>
```

Auto-apply the triage suggestion (heal on drift, retry on flake, stop on real bug):

```bash
npm run dev -- triage <name> --apply
# caps at 3 attempts by default; override with --max-attempts <n>
```

Run every saved test with auto-triage and write a markdown report (intended for CI):

```bash
npm run dev -- ci --out triage-report.md
```

## Model selection + cost reporting

Default model is `claude-opus-4-7`. Every command accepts `-m, --model`:

```bash
npm run dev -- explore "..." --url ... --model sonnet  # claude-sonnet-4-6
npm run dev -- triage my-test --apply --model haiku    # claude-haiku-4-5
```

Aliases: `opus` · `opus-4.6` · `sonnet` · `haiku`. Or pass a full model ID. `PROMPTOMATE_MODEL` env var is used when the flag is absent.

Every command that calls the API prints a one-line cost summary at the end:

```
  3 API calls · 8,412 in + 1,203 out · $0.0720 · claude-opus-4-7 ×3
```

Cost calc factors in cache read/write pricing. Per-model totals appear when multiple models are used in one run.

## Drop-in GitHub Action

Other repos can consume this repo as a reusable action:

```yaml
# .github/workflows/promptomate.yml in YOUR repo
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
      - uses: guttaashok1/promptomate@main  # or pin to a tag: @v0.1.0
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          # optional:
          model: sonnet
          max-attempts: "3"
```

Inputs: `anthropic-api-key` (required), `model`, `max-attempts`, `tests-dir`, `metadata-dir`.

For `${VARNAME}` placeholders in your prompts (SAUCE_PASSWORD, etc.), set them as **job-level** env in your workflow — composite-action inputs don't propagate that way:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      SAUCE_PASSWORD: ${{ secrets.SAUCE_PASSWORD }}
    steps:
      ...
```

## CI / GitHub Actions (this repo)

`.github/workflows/promptomate.yml` dogfoods the action on every PR:

1. Installs dependencies + Chromium (cached).
2. Runs `promptomate ci` — each saved test goes through auto-triage.
3. Uploads `triage-report.md` as a build artifact.
4. Posts (or updates) a single PR comment with the report — passed / auto-healed / flake recovered / real bug, one row per test.
5. Fails the check only if a real bug is detected or a test remained unrecovered.

Set `ANTHROPIC_API_KEY` as a GitHub Actions secret. For private repos, `permissions: pull-requests: write` is already set in the workflow.

## How it works

**`gen`** — one-shot:
1. Open the target URL in headless Chromium, capture the ARIA snapshot.
2. Claude Opus 4.7 emits a `.spec.ts` file using semantic locators.
3. Playwright runs the spec with screenshots and traces on failure.

**`explore`** — agentic, MCP-backed:
1. Spawn Microsoft's **Playwright MCP server** as a subprocess (`@playwright/mcp`).
2. Bridge its tool surface into the Anthropic API via `@modelcontextprotocol/sdk` — Claude gets `browser_navigate`, `browser_click`, `browser_hover`, `browser_drag`, `browser_type`, `browser_fill_form`, `browser_press_key`, `browser_snapshot`, `browser_take_screenshot`, `browser_file_upload`, `browser_tab_*`, `browser_network_requests`, `browser_console_messages`, `browser_wait_for`, etc.
3. Claude drives the browser: each tool call goes MCP client → server → real Chromium and returns an updated snapshot + refs.
4. When done, Claude emits a standalone `.spec.ts` using regular Playwright locators (`getByRole` / `getByText`) — the spec does NOT depend on MCP at runtime.

**`heal`** — on a locator failure, re-snapshots the page and regenerates the test with the latest DOM + prior failure context.

**`refine`** — iterate on a test without hand-editing the TypeScript. Takes an existing spec + a natural-language modification instruction + a fresh ARIA snapshot, and emits a surgical update. Use when you want to add an assertion, remove a check, adjust a wait, or change test data. Keeps the existing structure unless the instruction says otherwise.

**`triage`** — re-runs a failing test, captures the error output + a fresh ARIA snapshot + a screenshot of the current page, sends all of it to Claude, and gets back a verdict (`real_bug` / `flake` / `dom_drift`) with confidence and a concrete next action. Use when you don't know whether to `heal`, re-run, or file a bug.

**`triage --apply`** — auto-executes the verdict in a recovery loop: `dom_drift` → `heal` → re-run, `flake` → brief pause → re-run, `real_bug` → stop (exit code 2) because human attention is needed. Caps at 3 attempts. Exit code `0` if recovered, `1` if still failing, `2` if a real bug was diagnosed.

## Secrets

Never paste passwords, API tokens, or session cookies into prompts — they'd end up in `.promptomate/*.json` (committed metadata). Use `${VARNAME}` placeholders instead:

```bash
# in .env (gitignored)
SAUCE_PASSWORD=secret_sauce

# then
npm run dev -- explore "log in as standard_user with password \${SAUCE_PASSWORD}" --url https://www.saucedemo.com
```

How it works:
- Promptomate extracts `${VARNAME}` tokens from your prompt and resolves them against `process.env` (errors cleanly if unset).
- During `explore`: when the agent calls `browser_fill_form` or similar with `${VARNAME}`, the harness substitutes the real value before dispatching to the browser. Any tool result text gets scrubbed back to `${VARNAME}` so the value doesn't round-trip through the model unnecessarily.
- The generated `.spec.ts` uses `process.env.VARNAME ?? ""` — never the literal value. Playwright's config loads `.env`, so runs just work.
- Saved metadata stores the placeholder template (`"log in with password ${SAUCE_PASSWORD}"`), safe to commit.

Shell escape `\${...}` so your shell doesn't expand it before Promptomate sees it, or wrap the whole prompt in single quotes.

## Visual assertions

DOM-based assertions are fast and free but can't judge things like "looks like an error state" or "the chart shows a downward trend." For those, generated specs can import a Claude-vision-powered helper:

```ts
import { expectVisual } from "../src/assertions.js";

await expectVisual(page, "a red error banner above the Login button");
await expectVisual(page.getByRole("figure"), "a rendered image of a shoe, not a broken-image placeholder");
```

`expectVisual` takes a screenshot of the target (Page or Locator), sends it to Claude with the description, and throws if Claude judges it a fail. Costs one API call (~$0.01) and ~1s per assertion. The explore agent decides when to reach for it vs. a cheaper DOM check — during exploration it can also call `screenshot()` to see the actual render when the ARIA tree is ambiguous.

Tests are stored as `(prompt, generated code, URL)` triples under `.promptomate/`, so either surface — prompt or code — can be edited.

## Roadmap

- Agent-driven exploration via Playwright MCP (multi-step test discovery)
- Visual/semantic assertions via Claude vision
- Test data generation
- CI action with flake triage
- Web UI
