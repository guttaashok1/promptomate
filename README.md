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

Triage a failure — classify as real bug / flake / DOM drift and suggest a fix:

```bash
npm run dev -- triage <name>
```

Auto-apply the triage suggestion (heal on drift, retry on flake, stop on real bug):

```bash
npm run dev -- triage <name> --apply
# caps at 3 attempts by default; override with --max-attempts <n>
```

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

**`triage`** — re-runs a failing test, captures the error output + a fresh ARIA snapshot + a screenshot of the current page, sends all of it to Claude, and gets back a verdict (`real_bug` / `flake` / `dom_drift`) with confidence and a concrete next action. Use when you don't know whether to `heal`, re-run, or file a bug.

**`triage --apply`** — auto-executes the verdict in a recovery loop: `dom_drift` → `heal` → re-run, `flake` → brief pause → re-run, `real_bug` → stop (exit code 2) because human attention is needed. Caps at 3 attempts. Exit code `0` if recovered, `1` if still failing, `2` if a real bug was diagnosed.

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
