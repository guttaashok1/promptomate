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

Generate and run a test:

```bash
npm run dev -- gen "login with valid creds redirects to dashboard" --url https://app.example.com
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

1. **Explore** — open the target URL in headless Chromium, capture the accessibility tree.
2. **Generate** — Claude Opus 4.7 emits a `.spec.ts` file using semantic locators (`getByRole`, `getByText`, `getByLabel`) rather than brittle CSS selectors.
3. **Execute** — Playwright runs the spec with screenshots and traces on failure.
4. **Heal** — on a locator failure, `heal` re-snapshots the page and regenerates the test with the latest DOM + prior failure context.

Tests are stored as `(prompt, generated code, URL)` triples under `.promptomate/`, so either surface — prompt or code — can be edited.

## Roadmap

- Agent-driven exploration via Playwright MCP (multi-step test discovery)
- Visual/semantic assertions via Claude vision
- Test data generation
- CI action with flake triage
- Web UI
