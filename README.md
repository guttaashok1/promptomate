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

## How it works

**`gen`** — one-shot:
1. Open the target URL in headless Chromium, capture the ARIA snapshot.
2. Claude Opus 4.7 emits a `.spec.ts` file using semantic locators.
3. Playwright runs the spec with screenshots and traces on failure.

**`explore`** — agentic:
1. Launch a persistent Playwright session.
2. Claude gets `navigate`, `click`, `fill`, `press`, `snapshot` tools and drives the browser itself — clicking through the flow until the scenario is proven end-to-end.
3. Each tool result returns the updated ARIA snapshot so Claude can verify state after every action.
4. When done, Claude emits a standalone `.spec.ts` using the exact locators that worked.

**`heal`** — on a locator failure, re-snapshots the page and regenerates the test with the latest DOM + prior failure context.

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
