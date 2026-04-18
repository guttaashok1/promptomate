# Show HN post

## Title (max 80 chars)

```
Show HN: Promptomate – AI writes your Playwright tests, self-heals on UI change
```

## URL field

```
https://github.com/guttaashok1/promptomate
```

## Text field (optional — use this if you want to add context; otherwise leave empty and the title+URL is enough)

```
Hi HN — I built this because I kept watching QA engineers spend most of
their week updating Playwright locators after every UI change. Playwright
itself is great, but it has no AI, and the commercial self-healing tools
(Testim, Mabl) are proprietary + expensive.

Promptomate is an open-source CLI + web UI that:

- Generates Playwright specs from English scenarios. Claude drives a real
  browser via Microsoft's Playwright MCP server and writes a standalone
  .spec.ts using getByRole/getByText locators.
- Self-heals drifted locators when the UI changes (run `promptomate heal`,
  or `triage --apply` in CI).
- Classifies CI failures as real_bug / flake / dom_drift using Claude Vision
  on the actual failure screenshot + a fresh ARIA snapshot. The PR comment
  tells your team which red tests are actually blocking.
- Supports `expectVisual(page, "a red error banner")` — Claude judges the
  screenshot for checks that DOM assertions can't express.

It's MIT, bring-your-own Anthropic API key (typical gen cost: $0.02 on
Haiku to $0.25 on Opus). Runs fully local, or deploy the web UI to
Fly.io / Render for team use.

The wedge vs vanilla Playwright: AI-driven exploration + auto-heal + smart
triage. The wedge vs Testim/Mabl: open source, your code, your CI, your
API key.

Happy to answer questions about the architecture (MCP + manual agent
loop + prompt-cache-aware caching + structured XML output parsing) or
the tradeoffs (e.g. why Opus 4.7 default, when to drop to Sonnet/Haiku).

GitHub: https://github.com/guttaashok1/promptomate
npm: https://www.npmjs.com/package/promptomate
```

## Posting strategy

- **When**: Tuesday–Thursday, 8:00 AM PT (best window for HN front page)
- **Where**: https://news.ycombinator.com/submit
- **Title format**: Must start with `Show HN:` — HN's automatic rule
- **After posting**: don't spam comments. Answer questions honestly. Most upvotes come from the title hook + the first 30 min of traction.
- **Respond to every comment** for at least the first 4 hours. Engagement drives front-page rank.

## Post-launch follow-ups

- If the post hits front page: keep answering for 24 hours
- Write a follow-up blog post on promptomate.dev/blog about "what I learned from the HN launch"
- Pin a tweet linking to the HN thread
