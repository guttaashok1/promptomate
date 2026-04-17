# Claude guide for this repo

Promptomate is a prompt-driven Playwright test generator. Users describe a UI scenario in English; Claude Opus 4.7 (via the Anthropic SDK) drives a real browser through the Playwright MCP server, then emits a standalone `.spec.ts`. The same pipeline powers heal (repair after DOM drift), refine (semantic edits), and triage (classify failures as real bug / flake / dom drift).

## Quick map

| Path | Purpose |
|---|---|
| `src/cli.ts` | Commander entry. One subcommand per verb (gen, explore, refine, heal, triage, ci, serve, run, list). Loads dotenv with `override: true` before any other import so `new Anthropic()` sees the key. |
| `src/agent.ts` | `gen` — one-shot generation from a single ARIA snapshot of the landing page. |
| `src/explore.ts` | `explore` — agent loop: drives `@playwright/mcp` via the MCP client, tool-use loop with Claude, emits standalone spec. |
| `src/heal.ts` | `heal` — re-resolves drifted locators against a fresh snapshot. |
| `src/refine.ts` | `refine` — semantic edits driven by a natural-language instruction. |
| `src/triage.ts` | `triage` / `triage --apply` — classify failures, optionally auto-heal/retry. |
| `src/ci.ts` | `ci` — runs every saved test through triageAndApply, emits markdown. |
| `src/server.ts` + `public/index.html` | `serve` — Express + static page, SSE for live tool-call stream during explore. |
| `src/assertions.ts` | `expectVisual(target, description)` — Claude vision judges a screenshot, throws on fail. Consumed by generated specs as `import { expectVisual } from "../src/assertions.js"`. |
| `src/llm.ts` | `callModel(system, user, model?)` — the text-only call wrapper used by gen/heal/refine. Lazy-inits the Anthropic client so dotenv has time to load. |
| `src/models.ts` | Model aliases (opus/sonnet/haiku) + pricing table. `resolveModel()` precedence: CLI flag > `PROMPTOMATE_MODEL` > default (`claude-opus-4-7`). |
| `src/usage.ts` | Per-process token accumulator. Every place that calls the API must `recordUsage(model, response.usage)` after the call. CLI prints a one-liner summary at the end of each command. |
| `src/mcp-client.ts` | Thin wrapper around `@modelcontextprotocol/sdk` that spawns `playwright-mcp` via stdio. |
| `src/secrets.ts` | `${VARNAME}` placeholder handling. Extracted from the prompt, resolved from `process.env`, substituted into tool inputs at dispatch time, scrubbed back out of tool results. |
| `src/storage.ts` | `.promptomate/<name>.json` metadata + `tests/<name>.spec.ts` spec. `listTests`, `readMetadata`, `readSpec`, `saveMetadata`, `slugify`. |
| `playwright.config.ts` | Loads dotenv with `override: true` so `process.env.*` is available inside specs (used by `expectVisual` and any `${VARNAME}`-driven fills). |
| `.github/workflows/promptomate.yml` | Runs `promptomate ci` on PRs, upserts a single comment keyed off a hidden marker. |

## Conventions to follow

- **Always use `claude-opus-4-7` as the default model.** Resolve via `resolveModel(opts.model)`. Don't hardcode other IDs.
- **Adaptive thinking on all Opus 4.7 calls**: `thinking: { type: "adaptive" }`. `budget_tokens` is removed on 4.7.
- **Record usage after every API call**: `recordUsage(model, response.usage)` immediately after `client.messages.create()`. Missing sites make the cost summary wrong.
- **`${VARNAME}` is a secret**: never inline the resolved value in a generated spec. The system prompts for explore/gen/refine all say "use `process.env.VARNAME ?? ""`".
- **Generated specs must not reference MCP**: MCP refs are exploration-time only. The output is vanilla `@playwright/test` + semantic locators (`getByRole` / `getByText` / `getByLabel`).
- **Prefer semantic locators**: never CSS or XPath unless the element has no accessible name (e.g., saucedemo's `[data-test="shopping-cart-link"]`).
- **Module load order**: `new Anthropic()` must be lazy (inside the function that uses it), not module-level — ES module imports run before `dotenv.config()` in cli.ts.
- **`override: true` on dotenv**: shells sometimes have an empty `ANTHROPIC_API_KEY=` that would otherwise shadow the .env value.

## Things NOT to do

- Don't reintroduce the old in-process Playwright shim in `explore.ts`. MCP is the path forward — richer tool surface (hover, drag, file upload, `browser_fill_form`, `browser_network_requests`).
- Don't commit `triage-report.md`, `.playwright-mcp/`, or anything under `test-results/` — all gitignored.
- Don't hardcode the Anthropic API key anywhere; `.env` is gitignored and must stay that way.
- Don't weaken the `${VARNAME}` → `process.env.X` rule in system prompts. That rule is what keeps secrets out of committed specs.
- Don't skip `recordUsage` when adding a new API call site. The cost summary is a promise to the user.

## Runtime facts

- Node 20+, ESM (`"type": "module"`).
- TypeScript compiled to `dist/` (via `npm run build`); dev uses `tsx src/cli.ts`.
- Playwright installs Chromium via `npx playwright install --with-deps chromium` in CI; locally `npx playwright install chromium` is enough.
- `.env` must contain `ANTHROPIC_API_KEY=sk-ant-...`. Additional `${VARNAME}` placeholders used in prompts (e.g. `SAUCE_PASSWORD`) are resolved from the same `.env`.
- Web UI port: 3535. GitHub Action comment is keyed by `<!-- promptomate-report -->`.
