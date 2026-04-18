# Reddit — r/programming (and r/softwaretesting)

## Title

```
Promptomate — I put an AI agent layer on top of Playwright. Describes tests in English, self-heals when the UI changes, classifies failures. MIT, BYO Claude key.
```

## Body

```
Open-source Playwright tooling that uses Claude Opus 4.7 + Microsoft's
Playwright MCP server as the browser-control backend.

**Architecture (the interesting bits)**

1. **Agent-driven exploration**. `promptomate explore "<scenario>"` spawns
   the Playwright MCP subprocess, bridges its tool surface
   (`browser_navigate`, `browser_click`, `browser_hover`, `browser_drag`,
   `browser_fill_form`, `browser_type`, `browser_press_key`,
   `browser_take_screenshot`, `browser_network_requests`,
   `browser_console_messages`, ...) into Anthropic's tool-use API via a
   manual agent loop (not the beta tool runner — I want per-step
   observability). Claude drives a real Chromium, handles multi-step
   flows, and emits a standalone TypeScript spec using regular
   Playwright locators. MCP refs are ephemeral; the generated spec
   doesn't depend on MCP at runtime.

2. **Self-healing**. When a test fails, `promptomate heal <name>` captures
   a fresh ARIA snapshot and re-resolves the drifted locators. It's
   prompt-engineered to preserve the test intent — keep assertions,
   only update what changed.

3. **Failure triage**. `promptomate triage <name>` runs the test,
   captures the Playwright error output + a fresh screenshot +
   the current ARIA snapshot, sends all three to Claude Opus with
   vision, and gets back a structured verdict: real_bug / flake /
   dom_drift, with confidence + a concrete next-step suggestion.
   `--apply` auto-heals drift, retries flakes, stops on real bugs
   with exit code 2.

4. **Visual assertions**. `expectVisual(page, "a red error banner
   above the Login button")` screenshots the target and asks Claude
   Vision to judge. Useful for things DOM assertions can't express
   (loading states, chart trends, error styling).

5. **Secrets**. `${VARNAME}` in prompts get substituted at tool-
   dispatch time, scrubbed out of tool results so they don't round-
   trip through the model, and the generated spec uses
   `process.env.VARNAME ?? ""` — never the literal value.

6. **Auth fixtures**. `--auth <name>` saves storage state after a
   login spec runs; `--use-auth <name>` launches MCP with
   `--storage-state` so the agent sees an authenticated page and
   skips login steps. CI runs auth fixtures serially first, then
   fans out dependents with `--concurrency N`.

7. **GitHub Action**. `uses: guttaashok1/promptomate@v0.1.0`. Upserts
   a single PR comment (keyed off a hidden marker) with per-test
   verdicts. When auto-heal fires, the comment includes a
   `git diff` patch reviewers can copy-paste into `git apply`.

**Cost visibility**

Every command prints a per-run summary: `3 API calls · 8,412 in +
1,203 out · $0.0720 · claude-opus-4-7 ×3`. Cache read (×0.1) and
cache create (×1.25) pricing factored in. `--max-cost $0.50` aborts
runs that would exceed budget (exit code 3).

**Prompt engineering notes**

- Structured XML output: `<summary>...</summary><code>...</code>`.
  More reliable than JSON parsing in my testing because code strings
  have too many escaping edge cases.
- Adaptive thinking on Opus 4.7 (`thinking: { type: "adaptive" }`).
- Model defaults to Opus 4.7 with `--model opus|sonnet|haiku`
  aliases for cost tuning.

**Stack**

- TypeScript strict, ESM, Node 20+
- Express + static HTML for web UI (no framework)
- Playwright MCP + @modelcontextprotocol/sdk
- posthog-node for optional telemetry (off by default; set
  PROMPTOMATE_POSTHOG_KEY to enable, PROMPTOMATE_NO_TELEMETRY=1 to
  force off)
- MIT license

**Links**

- GitHub: https://github.com/guttaashok1/promptomate
- npm: https://www.npmjs.com/package/promptomate (`npm install -g
  promptomate`)
- GitHub Marketplace: https://github.com/marketplace/actions/
  promptomate-ci (approx URL)
- Architecture map: https://github.com/guttaashok1/promptomate/
  blob/main/CLAUDE.md

**What I'd love feedback on**

- MCP vs direct Playwright API: I went MCP for richer capabilities
  (hover, drag, file upload, network intercept) + future-compat
  with Playwright's direction. Downside: subprocess overhead, lose
  some control over launch args.
- Manual agent loop vs beta tool runner: I chose manual for
  per-step logging + custom error recovery. Not sure it'll age well.
- Default model: Opus 4.7 feels right for generation quality, but
  Sonnet 4.6 at 3x cheaper handles a lot of flows fine. Haiku 4.5
  struggles on multi-step exploration.

Criticism welcome.
```

## Notes

- r/programming has 6M subscribers; self-promo policed heavily. Lead with technical substance, not pitch.
- r/softwaretesting is smaller (~80k) but more patient with tool posts.
- Post during US business hours (9 AM – 1 PM ET) for max discussion.
