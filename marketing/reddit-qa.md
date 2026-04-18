# Reddit — r/QualityAssurance

## Title

```
I built an open-source AI layer on top of Playwright — describes tests in English, self-heals when the UI changes, classifies CI failures. Looking for QA folks to break it.
```

## Subreddit rules to re-check before posting

- [ ] r/QualityAssurance allows self-promotion for OSS tools (check current rules)
- [ ] Flair as "Resource" or "Discussion"
- [ ] Don't cross-post within 24 hrs to related subs
- [ ] Engage in comments — mods remove posts that get no author replies

## Body

```
Hi all — QA-curious dev here. After watching my team burn hours every
sprint patching locators after UI changes, I built a tool to see how
far AI can push the test-maintenance problem. Posting here because I'd
genuinely value the feedback from folks who live with flaky suites
every day.

**What it does**

promptomate is a CLI + web UI + GitHub Action:

1. You describe a scenario in English: "log in as standard_user, add
   a backpack to cart, verify badge shows 1". The agent drives a real
   browser via Microsoft's Playwright MCP, handles multi-step flows,
   then emits a standalone TypeScript Playwright spec using
   getByRole / getByText locators.

2. When UI changes break a test, `promptomate heal <name>` re-resolves
   the drifted locators against the current DOM. Or run
   `triage --apply` in CI to do it automatically.

3. When a test fails in CI, the GitHub Action comment classifies the
   failure as `real_bug` / `flake` / `dom_drift` — Claude Vision looks
   at the failure screenshot + a fresh ARIA snapshot + the test code
   and gives you a verdict with confidence + next step. Real bugs
   block the PR (exit code 2). Drift gets auto-healed with the diff
   included in the comment as a ready-to-`git apply` patch.

**Where it helps**

- Tests written by non-engineers (PMs, designers, analysts)
- Suites that break more from UI churn than real bugs
- Teams that don't want to pay $5k/mo for Testim or Mabl
- Anyone already invested in Playwright who wants AI layered on top

**Where it doesn't help yet**

- Complex SPAs with tons of async state (still brittle, like any
  E2E test)
- Tests that need extremely specific timing (AI-generated specs
  tend to over-wait)
- Anything requiring OCR of canvas/WebGL (DOM-only today)

**Tech**

- Claude Opus 4.7 default (cheaper `--model sonnet|haiku` available)
- Playwright MCP for browser control
- BYO Anthropic API key (typical generation: ~$0.02–$0.25 depending
  on model)
- MIT license, runs fully local, web UI optional

**What I'm looking for from you**

1. What breaks? Point it at your most-flaky test scenarios and tell
   me where the agent goes off the rails.
2. Is the triage verdict accurate on your real failures? I'd love
   to see false positives/negatives.
3. Where would this not survive in your team? Workflow, scale,
   auth, data-setup pain points I'm missing.

**Links**

- GitHub: https://github.com/guttaashok1/promptomate
- npm: `npm install -g promptomate`
- 2-min install → first green test: `promptomate quickstart`

Happy to dig into any of it. If you're curious about the agent prompt
design, the XML output contract, or the triage classifier's signals,
ask and I'll share specifics.
```

## After posting

- Reply to every comment in the first 4 hours
- When someone says "but what about X?" — answer concretely. Don't get defensive.
- Collect criticism as GitHub issues — "great point, filed as [#]"
- If you get a real bug, fix it same-day and comment back "shipped in v0.1.X"
