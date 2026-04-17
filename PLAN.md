# Promptomate — Product & Go-to-Market Plan

A single living doc covering every dimension of the business. Update checkboxes as you ship. Track KPIs and milestones at the bottom. Date-stamp major revisions.

**Current state** (Apr 2026): MVP shipped, deployed to Render with Basic auth, 8 reference tests green, open-source repo private. Pre-launch.

---

## 1. Intent / Vision

### Mission
Give every team — not just developers — the ability to describe a web test in English and get a real, self-maintaining Playwright spec they can trust in CI.

### Problem we solve
- **For QA engineers**: 60% of their week is spent maintaining broken tests after UI changes. Writing a new test means writing code.
- **For PMs/designers**: they know the product best but can't contribute to the test suite.
- **For engineering leaders**: "is this red test a real bug or drift?" eats Slack hours.

### Target user (in priority order)
1. **QA engineers at 20–200 person SaaS companies** — early adopters, hands-on with CI, feeling the pain most acutely.
2. **Staff/Senior engineers on small teams (<20)** adding tests to a product where formal QA doesn't exist yet.
3. **Product managers at engineering-heavy startups** who want to protect critical flows without filing a ticket.

### Positioning (one line)
> Playwright, but you write tests in English. They self-heal when the UI changes. CI tells you which red tests are real bugs.

### Key differentiators (must keep)
- [x] Prompt → Playwright spec via Claude Opus 4.7
- [x] MCP-backed agentic exploration (not just one-shot snapshot)
- [x] Self-healing locators
- [x] AI failure triage (real bug / flake / dom drift)
- [x] Visual assertions via Claude Vision
- [x] `${VARNAME}` secret placeholders
- [x] Auth fixtures (login once, reuse)
- [x] GitHub Action with PR comments + healed-diff patches
- [x] Web UI for non-technical users
- [x] Open source (MIT), BYO API key
- [ ] Per-test run history + trends (post-launch)
- [ ] Shared cloud workspaces (post-launch)

---

## 2. Product / MVP

### MVP scope (what "v0.1.0 launch" means)
- [x] All 10 CLI commands working (`init`, `gen`, `explore`, `refine`, `heal`, `triage` ±`--apply`, `ci`, `serve`, `run`, `list`)
- [x] Web UI (`serve`) with live SSE, saved tests, run/triage/refine/view
- [x] GitHub Action (`uses: guttaashok1/promptomate@main`) with PR comments + heal diff
- [x] Tags, parallel `ci`, diff-based selection, cost reporting, model flags
- [x] Render deploy with Basic auth
- [x] 44 unit tests, CLAUDE.md for future AI sessions
- [ ] `promptomate` published to npm (`npm install -g promptomate`)
- [ ] `v0.1.0` git tag + GitHub Release
- [ ] GitHub Action published to Marketplace
- [ ] Public GitHub repo (currently private)
- [ ] Landing page at `promptomate.dev` (or similar)
- [ ] Demo GIF embedded in README (60 sec: explore → break → triage → auto-heal)
- [ ] 3 hardening items before Render public demo:
  - [ ] `explore` won't OOM on free tier (add `--low-memory` using `chromium-headless-shell`)
  - [ ] Interactive `promptomate quickstart` (init → API key prompt → first test in one flow)
  - [ ] Persistent demo hosting (Fly.io free volumes or Render Starter tier $7/mo)

### Post-MVP features (priority order)
- [ ] `promptomate record` — point at URL, click through manually, English narration + clicks become a test (~1 week)
- [ ] Shared cloud workspace (Postgres + NextAuth + Vercel) — team plan unlock (~3 weeks)
- [ ] Slack app — notified of auto-heals in PRs, one-click approve (~3 days)
- [ ] VS Code extension — right-click in Playwright trace → "generate test" / "refine" (~2 weeks)
- [ ] Jira 2-way integration — `real_bug` auto-files ticket with trace attached (~1 week)

---

## 3. Marketing

### Launch plan (2 weeks)

**Week 1 — ship-ready**
- [ ] Polish README (hero, GIF, comparison table, install in 3 commands, badges)
- [ ] Record 60-sec demo GIF (asciinema → agg, or screen recording of web UI)
- [ ] Write comparison chart vs Playwright, Cypress, Testim, Mabl, Tosca
- [ ] `npm login && npm publish` (already npm-ready)
- [ ] Tag `v0.1.0`, publish GitHub Action to Marketplace
- [ ] Make repo public
- [ ] Landing page: Next.js + shadcn on Vercel. Hero, GIF, comparison, install, CTA to GitHub + live demo

**Week 2 — launch**
- [ ] Show HN post (Tuesday 8am PT): "I built an AI test generator for Playwright that self-heals when the UI changes"
- [ ] Twitter/X thread same day: problem → GIF → 3 features → link
- [ ] Product Hunt launch (next Tuesday)
- [ ] Reddit posts in `/r/QualityAssurance`, `/r/softwaretesting`, `/r/programming`
- [ ] Dev.to post: "Building self-healing Playwright tests with Claude" (technical deep-dive)
- [ ] Submit to tool directories: Awesome-Playwright, awesome-lists/awesome-testing, alternativeto.net

### Ongoing content (post-launch)
- [ ] Monthly blog post on `promptomate.dev/blog` — real usage stories, flake stats from real projects
- [ ] YouTube: 5-min weekly "flake of the week" series using real bug reports from users
- [ ] Twitter presence: @promptomate account, daily small tips + retweets of users shipping
- [ ] Case study page once 3 paying customers are live

### Launch channels — target impressions + realistic click-through
| Channel | Reach | CTR to site | Site→star | Star→signup |
|---|---|---|---|---|
| Show HN (front page) | 30,000–50,000 | 10–15% | 8–12% | 2–5% |
| Product Hunt (#1) | 5,000–10,000 | 15% | 15% | 5% |
| Twitter (organic) | 2,000–10,000 | 3% | 10% | 3% |
| Reddit | 2,000–5,000 per sub | 5% | 8% | 2% |
| Dev.to | 1,000–5,000 | 5% | 10% | 5% |

Expected week-1 results (if launches go well): 500–1,500 GitHub stars, 100–300 landing page signups, 10–30 active users.

---

## 4. Sales

### Phase 1 (launch to 1,000 stars): zero sales
Pure self-serve. No sales motion. CLI is free forever; cloud tier is $0 until we have features worth charging for.

### Phase 2 (1,000+ stars, month 3+): inbound SaaS
- [ ] Pricing page live on landing site
- [ ] Stripe integration for self-serve team tier ($20/user/mo)
- [ ] Book-a-demo button for teams of 10+ — you do the call yourself
- [ ] Simple intake form: team size, current test stack, pain points

### Phase 3 (50+ paying teams, month 6+): add a salesperson
- [ ] Hire a part-time AE (contract, $3k/mo base + commission)
- [ ] Outbound to mid-market QA leaders via LinkedIn
- [ ] Case studies + ROI calculator (cost of broken tests per month)

### Phase 4 (month 12+): enterprise
- [ ] SOC 2 Type II audit ($30–50k, 6-month process)
- [ ] SAML SSO
- [ ] On-prem / self-hosted installer
- [ ] Annual contracts, procurement-friendly

---

## 5. Revenue / Pricing

### Pricing tiers (design for day-one launch readiness)

| Tier | Price | Target | What's included |
|---|---|---|---|
| **Free (OSS)** | $0 | Solo devs, evaluators | CLI, self-hosted web UI, GitHub Action, BYO Anthropic key. Forever free. |
| **Team Cloud** | $20/dev/mo | 5–50 dev teams | Hosted dashboard, shared workspaces, no API key mgmt (we pay Anthropic), team auth, run history. |
| **Business** | $100/user/mo | 50+ teams | Everything above + Jira/Slack/Linear integrations, audit log, scheduled reports, priority support. |
| **Enterprise** | Contact | Regulated industries | On-prem or VPC, SAML SSO, SOC 2, custom contracts, dedicated support. |

### Unit economics (Team Cloud at $20/user/mo)
- **Anthropic API cost** per active user per month: ~$5–15 (Opus-heavy), ~$1–3 (Haiku-heavy)
- **Infra cost** per user: ~$1–2
- **Gross margin**: 60–80% after API costs → healthy
- **Break-even**: need ~50 paying Team seats to cover founder time ($5k/mo opportunity cost)

### Revenue goal trajectory (conservative)
- [ ] Month 1 post-launch: $0 (free only)
- [ ] Month 3: $500 MRR (25 Team seats)
- [ ] Month 6: $3,000 MRR (150 seats)
- [ ] Month 12: $15,000 MRR (750 seats + first Business deal)
- [ ] Month 24: $50,000 MRR + first enterprise deal

---

## 6. Service / Support

### Launch-era support (first 3 months)
- [ ] GitHub Issues — primary channel, respond within 24h during launch
- [ ] Discord server for real-time chat — spin up day 1
- [ ] `support@promptomate.dev` email — checked daily
- [ ] `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` — lower friction for PRs

### Response time SLA (internal target, not publicly promised yet)
- Launch week: 4-hour first response
- Month 1–3: 24-hour first response
- Paid tier (future): 4-hour business-day first response

### Self-serve documentation
- [x] README.md with quickstart
- [x] CLAUDE.md for future AI-assisted work
- [ ] `/docs` folder with deeper guides:
  - [ ] "Writing your first test"
  - [ ] "Using `${VARNAME}` for secrets"
  - [ ] "Auth fixtures: login once, reuse everywhere"
  - [ ] "Setting up GitHub Action CI"
  - [ ] "Handling flaky tests"
  - [ ] "Cost control + using cheaper models"
- [ ] Searchable docs site (Mintlify, Docusaurus, or just Markdown in repo)

---

## 7. Experience (UX / DX)

### First-run journey (day-one priority)

The 60-second activation target:
1. User reads README → decides to try
2. `npm install -g promptomate` → ~30 sec
3. `promptomate quickstart` → interactive: sets up `.env`, prompts for Anthropic key, offers demo scenarios
4. User picks "Try saucedemo login" → explore runs live → green test in 45 sec
5. User sees cost: `$0.23, 5 API calls` — no surprises
6. User is activated

### DX goals
- [x] Every command prints actionable output (verdict + suggestion, not just errors)
- [x] Secrets are obvious (`${VAR}` in metadata, `process.env.X` in specs)
- [x] Cost is always visible
- [ ] Errors link to docs (`See: promptomate.dev/docs/errors/auth-fixture-missing`)
- [ ] `promptomate doctor` command — checks API key, Playwright install, disk space, etc.
- [ ] `promptomate quickstart` interactive

### UX polish (web UI)
- [ ] Dark mode toggle
- [ ] Model dropdown (opus/sonnet/haiku) on the generate form
- [ ] Test history timeline (how pass rate has changed over last 10 runs)
- [ ] Inline screenshot preview of failures
- [ ] Keyboard shortcuts (press `g` → go to Generate, `/` → search tests)

### Accessibility (must-fix before public launch)
- [ ] Form inputs have labels
- [ ] All interactive elements keyboard-navigable
- [ ] Color contrast WCAG AA for text and badges
- [ ] Alt text on emoji icons

---

## 8. Analytics

### Instrumentation (Phase 1: launch-era)

Use [PostHog](https://posthog.com) (free tier, open source, privacy-friendly). One script on the landing page, one SDK call per CLI command.

**Events to capture (web UI + CLI):**
- [ ] `cli_command_ran` (command, success, duration, model, cost_usd)
- [ ] `test_generated` (method: gen|explore, tool_call_count, duration, cost)
- [ ] `test_run_completed` (passed, duration)
- [ ] `triage_verdict` (verdict, confidence, auto_applied)
- [ ] `heal_attempted` (success)
- [ ] `ui_page_view` (page)
- [ ] `ui_button_click` (button)

**Opt-out**: respect a `PROMPTOMATE_NO_TELEMETRY=1` env var. Document it in README + `promptomate --help`.

### Metrics to watch weekly

**Adoption**
- Daily active CLIs (via telemetry ping)
- Weekly new installs (npm download stats)
- GitHub: stars, forks, issues opened, PRs merged
- Landing page: unique visitors, signup conversion

**Product health**
- % of `triage` runs where the verdict was correct (needs user feedback loop)
- % of `heal` attempts that produced a passing test
- % of `explore` runs that completed under 60 seconds
- Median tool calls per `explore` (target: 5–8)
- Median cost per generation (target: <$0.25)

**Revenue (post-launch)**
- Free → Team conversion rate
- Team seats activated
- MRR, ARR, gross margin
- Churn: % of Team accounts cancelling per month

### Dashboards
- [ ] Public stats page (`promptomate.dev/stats`): stars, npm downloads, # of tests generated last 30d. Builds trust via transparency.
- [ ] Internal weekly ops dashboard: the above + revenue

---

## 9. Phased Roadmap

Each phase has a theme, deliverables, and a KPI gate before moving on.

### Phase 0: Pre-launch (now → 2 weeks)
**Theme:** Get to a shippable, public v0.1.0.
- [ ] Complete the 3 hardening items (explore OOM, quickstart, persistent demo)
- [ ] Polish README + record GIF
- [ ] npm publish
- [ ] GitHub Action Marketplace publish
- [ ] Landing page live
- [ ] Repo public

**Gate:** A stranger can install and generate their first test in under 5 minutes.

### Phase 1: Launch (week 3)
**Theme:** Distribution.
- [ ] Show HN
- [ ] Product Hunt
- [ ] Twitter, Reddit, Dev.to
- [ ] Respond to every issue and mention for 2 weeks

**KPI gate:** ≥500 GitHub stars, ≥50 daily active CLIs by end of week 4.

### Phase 2: Harden & iterate (month 2–3)
**Theme:** Make the free product beloved.
- [ ] Fix every high-quality issue reported in launch week
- [ ] Add `promptomate record` (codegen-with-narration)
- [ ] `promptomate doctor` diagnostic
- [ ] Slack integration for PR comments
- [ ] Docs site

**KPI gate:** ≥1,500 stars, ≥200 DAU, clear signal of 10–20 power users.

### Phase 3: Cloud team tier (month 3–5)
**Theme:** First revenue.
- [ ] Postgres + auth (Clerk or NextAuth)
- [ ] Multi-tenant workspace model
- [ ] Stripe billing
- [ ] Hosted dashboard with run history, trends
- [ ] Migrate private beta users to paid

**KPI gate:** $1,000 MRR by month 5.

### Phase 4: Business tier (month 5–9)
**Theme:** Fit team QA workflows.
- [ ] Jira 2-way integration
- [ ] VS Code extension
- [ ] Audit log
- [ ] Scheduled reports
- [ ] Linear + Asana integrations

**KPI gate:** $10,000 MRR, 5+ Business-tier deals.

### Phase 5: Enterprise (month 9–18)
**Theme:** Move upmarket.
- [ ] SOC 2 Type II
- [ ] SAML SSO (via WorkOS)
- [ ] Self-hosted installer
- [ ] Dedicated support tier
- [ ] First AE hire

**KPI gate:** First $30k+ annual contract signed.

---

## 10. Milestones & KPI tracker

Fill in as you go.

| Milestone | Target date | Status | Actual date | Notes |
|---|---|---|---|---|
| v0.1.0 shipping-ready | 2026-04-24 | ⬜ | | |
| Landing page live | 2026-04-24 | ⬜ | | |
| npm published | 2026-04-25 | ⬜ | | |
| Repo public | 2026-04-28 | ⬜ | | |
| Show HN launch | 2026-04-29 | ⬜ | | |
| 500 GitHub stars | 2026-05-15 | ⬜ | | |
| 100 weekly active CLIs | 2026-06-01 | ⬜ | | |
| First paying customer | 2026-08-01 | ⬜ | | |
| $1k MRR | 2026-09-30 | ⬜ | | |
| $10k MRR | 2027-01-31 | ⬜ | | |
| First enterprise deal | 2027-10-01 | ⬜ | | |

### Weekly review cadence

Every Friday, update:
- Star count
- Weekly active CLIs (from PostHog)
- MRR (from Stripe, post-paid launch)
- New issues vs closed issues
- One learning from the week
- One blocker to unblock next week

Keep it short — this doc is for decisions, not status reports.

---

## 11. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Anthropic raises prices | Medium | High | Support multiple providers (OpenAI, Gemini) via an adapter; keep BYO key as the escape valve. |
| Playwright MCP breaking changes | High | Medium | Pin exact version; keep the old in-process shim in a branch as fallback. |
| Competitor ships self-healing Playwright first (Testim, Mabl) | High | Medium | Lean hard on open source + local-first — their pricing and lock-in are the weakness. |
| Demo sites (saucedemo, etc.) block headless browsers | Medium | Low | Curate a list of bot-friendly demo targets; encourage local use for real apps. |
| Users expose Promptomate publicly without auth | Medium | High | Already have `PROMPTOMATE_AUTH_TOKEN`; warn loudly in docs; maybe add rate-limiting per IP. |
| Cost surprises for users | Medium | Medium | Per-run cost line (done); `--max-cost` budget guardrail (todo). |

---

## 12. Decisions log

Why certain choices were made. Helps future-you avoid re-litigating.

- **2026-04-16** — Chose Playwright MCP over in-process shim. Richer tool surface (hover, drag, network inspection) and future-compat with Playwright's official direction outweighs subprocess overhead.
- **2026-04-16** — Chose Claude Opus 4.7 as default. Better instruction following and vision than Sonnet/Haiku for this use case. `--model` flag lets cost-sensitive users downgrade.
- **2026-04-17** — Kept secrets in `process.env`, not a separate vault. `${VAR}` template syntax is familiar to every shell user; a vault is a later enterprise feature.
- **2026-04-17** — Decided against an auto-commit-heal-to-PR pattern in the GitHub Action. Diff-in-comment is cleaner; devs prefer to review before committing.
- (add new decisions here as you make them)

---

_Last updated: 2026-04-17. Update the date in this line when you edit the doc._
