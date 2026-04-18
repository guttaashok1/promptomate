# Twitter/X launch thread

**Post time**: same day as Show HN, right after the post goes live. Link to the HN thread in the last tweet.

---

## Tweet 1 (hook)

```
Playwright tests written in English. Self-heal when the UI changes.
CI that tells you which red tests are real bugs.

I built this in a month. MIT, local-first, bring-your-own Claude key.

🧵
```

📎 Attach: demo GIF (once recorded — see marketing/demo-gif-script.md)

---

## Tweet 2 (the problem)

```
Every QA team I've worked with spends 60%+ of their time updating test
locators after UI changes.

- Button renamed? Tests break.
- Form restructured? Tests break.
- "Is this red test a real bug or drift?" → a Slack thread every morning.

This shouldn't be a full-time job.
```

---

## Tweet 3 (what promptomate does)

```
promptomate explore "log in with valid creds and see dashboard" --url https://app.example.com

Claude drives a real Chromium via Playwright MCP. It figures out the
flow, handles multi-step clicks, then emits a standalone TypeScript
Playwright spec using semantic locators.

45 sec. $0.25.
```

---

## Tweet 4 (self-healing)

```
When the UI changes and your test fails:

promptomate triage --apply my-test

The agent looks at the error + a fresh screenshot + the current DOM,
classifies the failure (real_bug / flake / dom_drift), and auto-fixes
drift by regenerating the broken locator.

CI exit code 2 = real bug. Block the PR.
```

---

## Tweet 5 (visual assertions)

```
For checks the DOM can't express:

  await expectVisual(page, "a red error banner above the Login button")

Claude Vision judges the screenshot. Throws if it doesn't match.
~$0.01 per assertion.

No more brittle CSS selectors on your error states.
```

---

## Tweet 6 (GitHub Action)

```
PR comment on every test run:

✅ 8 passed · 🩹 1 auto-healed · 🐛 1 real bug
| user-login      | ✅ passed      |
| add-to-cart     | 🩹 healed      | Button renamed "Add" → "Buy"
| checkout        | 🐛 real bug    | Total shows $64 (expected $32)

Includes a ready-to-`git apply` diff when it heals a locator.
```

---

## Tweet 7 (comparison)

```
Why not Testim/Mabl/Tosca?

- Tosca: no AI, $50k+/yr, drag-drop only
- Testim/Mabl: AI ✅, but closed-source, cloud-only, $5k+/mo
- Playwright: OSS ✅ code ✅, but no AI

Promptomate sits at the intersection of OSS + AI + local-first.
Nothing else does.
```

---

## Tweet 8 (how it's built)

```
Under the hood:

- Claude Opus 4.7 by default (--model haiku/sonnet for cost)
- Microsoft's Playwright MCP server for browser control
- Manual tool-use loop (not the beta tool runner) for observability
- Structured XML output, prompt-cache-aware
- process.env secrets, scrubbed from every tool result

MIT. ~2k LoC.
```

---

## Tweet 9 (call to action)

```
npm install -g promptomate
promptomate quickstart

Set your Anthropic key, pick a demo scenario, watch it generate +
run your first test in under 2 minutes.

GitHub: https://github.com/guttaashok1/promptomate
npm: https://npmjs.com/package/promptomate
```

---

## Tweet 10 (HN link)

```
Just posted this on HN. Would love feedback — especially from QA
teams and anyone who's tried to build AI-assisted testing tools.

https://news.ycombinator.com/item?id=<HN_ID>
```

Replace `<HN_ID>` with the actual ID from the HN submission URL after it goes live.

---

## Follow-up content (over the next week)

- **Day 2**: screenshot of a real PR comment with auto-healed diff → "this is what CI looked like today"
- **Day 3**: short clip of the web UI — non-engineer types a scenario, watches it run
- **Day 5**: "1 week in, here's what users said" — 3 concrete pieces of feedback + what you changed
- **Day 7**: "how Promptomate classifies a flake vs a real bug" — technical thread on the triage prompt

## Hashtags (sparingly — max 2 per tweet in hashtag-heavy ones)

`#Playwright`, `#QualityAssurance`, `#Testing`, `#OpenSource`, `#AI`, `#Claude`
