# Dev.to deep-dive

**Canonical URL**: Post here as primary (https://dev.to/new), set canonical to your blog if you ever have one.

**Cover image**: Screenshot of a PR comment with a 🩹 auto-heal verdict + diff (see `marketing/cover-image-ideas.md` — TBD).

**Tags**: `playwright`, `testing`, `ai`, `claude`

---

## Title

```
Building self-healing Playwright tests with Claude: a deep-dive into Promptomate
```

## Subtitle (optional)

```
How I used Claude Opus 4.7 + Microsoft's Playwright MCP to build an open-source tool that writes Playwright tests from English and heals them when the UI changes.
```

---

## Article

```markdown
## The problem

At every team I've worked with, QA engineers spend 60%+ of their sprint
time patching Playwright locators. A button gets renamed, a form gets
restructured, a CSS class changes — and suddenly half the suite is red.

Existing AI-powered testing tools (Testim, Mabl) solve this but at
$5k+/month and with proprietary cloud platforms. I wanted to see what
was possible as open source with bring-your-own-API-key.

The result is **Promptomate** — a CLI + web UI + GitHub Action that
lets you describe tests in English, self-heals locators when the DOM
changes, and classifies CI failures as real bugs vs flakes vs UI
drift. MIT, runs fully local, ~2,000 lines of TypeScript.

This post walks through how it's built.

## Architecture at a glance

```
User prompt
    ↓
Agent loop (Anthropic SDK, manual tool-use)
    ↓
Playwright MCP subprocess (Microsoft's official server)
    ↓
Real Chromium — clicks, types, drags, hovers
    ↓
Generated standalone .spec.ts (regular Playwright locators, no MCP)
    ↓
Playwright test runner executes it
```

The key insight: Promptomate is *not* a new test runner. The generated
specs are ordinary Playwright tests you can run, edit, version, and
run in any CI without Promptomate installed. The tool only exists to
*author* and *heal* those tests.

## Agent-driven exploration

The `explore` command is the centerpiece. Given a scenario like "log
in as standard_user with password ${SAUCE_PASSWORD} and verify the
products page appears", here's what happens:

1. **Subprocess spawn**: Promptomate launches `playwright-mcp` as a
   child process over stdio. The `@modelcontextprotocol/sdk` package
   handles protocol framing.

2. **Tool discovery**: `await mcpClient.listTools()` returns
   `browser_navigate`, `browser_click`, `browser_hover`,
   `browser_drag`, `browser_type`, `browser_fill_form`,
   `browser_press_key`, `browser_take_screenshot`, `browser_snapshot`,
   `browser_tab_*`, `browser_network_requests`,
   `browser_console_messages`, `browser_wait_for`, and more. We
   translate the MCP schemas to Anthropic's `Tool[]` format.

3. **Manual agent loop**: rather than use the beta tool runner, I
   run the loop by hand — `messages.create()`, inspect response
   content for `tool_use` blocks, dispatch each to the MCP client,
   translate the result back (including images from
   `browser_take_screenshot`), append `tool_result` blocks to the
   message history, repeat. This gives per-step logging and custom
   error recovery.

4. **XML output contract**: the system prompt asks the model to end
   its final response with exactly:

   ```
   <summary>One-line summary of what the test verifies.</summary>
   <code>
   // complete TypeScript Playwright spec
   </code>
   ```

   I chose XML over JSON because code strings have too many escaping
   edge cases in JSON. A regex pulls the two fields out.

5. **Spec generation**: the generated code uses regular Playwright
   locators (`getByRole`, `getByText`, `getByLabel`) — never MCP
   refs, which are ephemeral exploration artifacts. The system
   prompt is explicit about this distinction.

## Self-healing

When a test breaks because the UI changed, `promptomate heal <name>`:

1. Captures a fresh ARIA snapshot of the target URL.
2. Reads the current (broken) spec + the original English prompt +
   the latest failure output.
3. Asks Claude to emit an updated spec that preserves the test
   intent but updates only the drifted locators.

The prompt is explicit: "Preserve all existing imports, assertions,
structure. Only modify what the snapshot shows has actually changed."

In practice, heal succeeds maybe 70% of the time on first shot. When
it doesn't, `triage --apply` retries up to 3 times with increasing
context.

## Failure triage — the classifier

This is the feature I'm most excited about. When a CI run is red,
`promptomate triage --apply <name>` does:

1. Runs the test, captures Playwright's error output.
2. Navigates to the starting URL in a fresh browser, takes a
   screenshot + ARIA snapshot.
3. Sends all three (error text, current ARIA, current screenshot)
   to Claude Opus 4.7 with vision.
4. Claude returns:

   ```
   <verdict>real_bug | flake | dom_drift</verdict>
   <confidence>low | medium | high</confidence>
   <reason>One sentence citing specific evidence.</reason>
   <suggestion>Concrete next step.</suggestion>
   ```

The system prompt gives the classifier explicit signals:

- "Element not found" + current snapshot shows a renamed/moved
  equivalent → `dom_drift`
- "Element not found" + NO sign of the expected element anywhere →
  `real_bug` (feature regressed)
- Timeout but current state shows the expected result DID load →
  `flake`
- Assertion on content where current state contradicts expectation
  → `real_bug`

`--apply` then:
- `dom_drift` → runs `heal`, re-runs the test
- `flake` → brief pause, retries
- `real_bug` → stops, exit code 2

In CI, the GitHub Action posts a PR comment:

```
🤖 Promptomate Test Report
✅ 8 passed · 🩹 1 auto-healed · 🐛 1 real bug

| Test          | Status           | Details                       |
| user-login    | ✅ passed        |                                |
| add-to-cart   | 🩹 auto-healed   | Button renamed "Add" → "Buy"  |
| checkout      | 🐛 real bug      | Total shows $64 (expected $32)|
```

When auto-heal fires, the comment also includes a `git diff` patch
reviewers can `git apply` locally.

## Visual assertions

Some checks can't be expressed in the DOM:

```ts
await expectVisual(page, "a red error banner above the Login button");
await expectVisual(page.getByRole("figure"), "a rendered product image, not a broken-image placeholder");
```

`expectVisual` screenshots the target, sends it to Claude with the
description, and throws if Claude judges it a fail. The system prompt:

> Be strict but not pedantic — match the spirit of the description,
> not pixel-perfect wording. Minor styling variance is fine; a
> completely wrong page state is not.

Costs ~$0.01 per assertion, takes ~1 second. I don't use it for
things DOM assertions already cover — that would waste tokens and
time.

## Secrets and auth

Two big security-aware features:

### `${VARNAME}` placeholders

Prompts can reference env vars: `"log in with password
${SAUCE_PASSWORD}"`. The harness:

- Extracts placeholder names from the prompt
- Resolves them from `process.env` (errors cleanly if missing)
- Substitutes into tool inputs at dispatch time (so the MCP `fill_form`
  gets the real value, but the Anthropic API call only sees the
  placeholder)
- Scrubs results — if the value round-trips in a snapshot, we
  replace it back with `${VARNAME}` before sending to the model
- The generated spec uses `process.env.VARNAME ?? ""` — never the
  literal value

Saved metadata stores the placeholder template, so committed
`.promptomate/*.json` files are safe.

### Auth fixtures

Playwright's `storageState` pattern, wired end-to-end:

```bash
# Setup: produces .promptomate/auth/sauce-user.json
promptomate explore "log in as standard_user" \
  --url https://www.saucedemo.com --auth sauce-user

# Consumers: skip the login flow entirely
promptomate explore "add backpack to cart" \
  --url https://www.saucedemo.com/inventory.html --use-auth sauce-user
```

MCP is launched with `--storage-state ...` so the exploration agent
sees an already-authenticated page and doesn't need to click through
login. The consumer spec starts with `test.use({ storageState: ... })`.
CI runs auth fixtures serially first (each produces its session file),
then fans out dependents with `--concurrency N`.

## Cost visibility

Every command that calls the API prints a summary:

```
3 API calls · 8,412 in + 1,203 out · $0.0720 · claude-opus-4-7 ×3
```

Cache read (×0.1) and cache create (×1.25) pricing factored in.
`--max-cost $0.50` aborts runs that would exceed budget (exit code 3).

`--model opus|sonnet|haiku` for cost tuning. Default is Opus 4.7 for
generation quality. Sonnet 4.6 at ~3x cheaper handles most flows
fine. Haiku 4.5 struggles on multi-step exploration but works for
refine and triage.

## What surprised me building this

1. **The agent self-corrects more than I expected**. On the
   saucedemo checkout flow, Claude tried 3 wrong "Add to cart"
   locators before navigating directly to the product detail page.
   Then it wrote a *cleaner* final spec than what it actually did
   during exploration — scoping the backpack with `.filter({
   hasText: "Sauce Labs Backpack" })` to resolve the ambiguity.

2. **Structured XML beats JSON for code output**. JSON string
   escaping with embedded TypeScript is painful; the model gets it
   wrong ~1 in 20 times. With XML wrappers, parsing is dead-simple.

3. **Visual assertions work better than I expected**. I thought
   Claude Vision would be too lenient. Actually it catches "this
   page shows the login form instead of the dashboard" reliably.
   The failure mode is over-strict ("the banner is more orange than
   red") not over-lenient.

4. **Triage is the feature that gets the most love from users**.
   Flake/drift/bug classification is the thing nobody else offers,
   and it's what turns a 47-red-test morning into "1 of these is a
   real bug, here's which."

## Links

- **GitHub**: https://github.com/guttaashok1/promptomate
- **npm**: `npm install -g promptomate`
- **GitHub Action**: `uses: guttaashok1/promptomate@v0.1.0`
- **Architecture map (for contributors)**: [CLAUDE.md](https://github.com/guttaashok1/promptomate/blob/main/CLAUDE.md)

## Feedback welcome

If you try it, tell me where it breaks. Especially interested in:

- Scenarios where `explore` goes off the rails
- Triage verdicts that are wrong on real failures
- Pricing friction (is BYO API key the right default?)
```

---

## After posting

- Cross-post to hashnode.dev if you have a blog there
- Share the link in a tweet (one tweet, not a full thread — the
  main thread already covers the pitch)
- Expect ~2–3 hours of comment responses if it gets traction

## SEO note

Dev.to indexes well on Google. A technical deep-dive like this
can drive organic traffic for months. Target keyword:
"Playwright AI testing".
