# Wake-up checklist

When you wake up, everything below is ready to ship. Nothing requires writing from scratch — just review, tweak, and press publish.

## What happened overnight (well, in my last ~30 min)

Shipped 16 of 46 issues closed total:
- Phase 0: 7 done (init, gen, explore, refine, heal, triage, ci, --low-memory, quickstart, doctor, --max-cost, Fly.io config, …)
- Phase 1: 6 launch post drafts written
- Phase 2: doctor, telemetry
- Landing page scaffolded in sibling repo (deploy pending)
- Weekly report command shipped

All commits on `main`. All changes pushed. Repo has 46 issues + a Roadmap Project board: https://github.com/users/guttaashok1/projects/2

## Top-priority actions for today (~3 hours total)

In this exact order, because each unblocks the next:

### 1. Deploy the landing page (~10 min)

```bash
cd /Users/ashokkumargutta/Desktop/Ashok/Projects/promptomate-landing
gh repo create guttaashok1/promptomate-landing --public --source=. --push
npm install -g vercel
vercel --prod
```

You'll get a URL like `promptomate-landing.vercel.app`. Save it — every launch post below references it.

Optional: point a custom domain (e.g. `promptomate.dev`) at the deploy via Vercel dashboard.

### 2. Record the demo GIF (~30 min)

Full script at [`marketing/demo-gif-script.md`](marketing/demo-gif-script.md). TL;DR:

1. Clean terminal + Chrome, side-by-side
2. Record with Kap or macOS Cmd+Shift+5
3. Follow the 5-scene script: **explore → show code → run → break → triage --apply**
4. Under 75 seconds. Target 3–5 MB GIF.
5. Save to `public/demo.gif` in promptomate repo AND `promptomate-landing/demo.gif`
6. Update landing page: replace the "Demo GIF — coming soon" placeholder with `<img src="/demo.gif" alt="Promptomate demo" />`
7. Update README hero: add the GIF link under the install command
8. Redeploy landing (`vercel --prod` again) + push main repo

### 3. Launch posts (~90 min — most is just reviewing drafts)

All drafts are in `marketing/`. Review, tweak, press publish.

Order + timing (everything same day; Tuesday 8 AM PT is ideal):

1. **[8:00 AM PT] Show HN** — [`marketing/hacker-news.md`](marketing/hacker-news.md)
   - Submit at https://news.ycombinator.com/submit
   - Title + URL (text field optional)
   - Monitor for 4 hours, answer every comment

2. **[8:05 AM PT] Twitter thread** — [`marketing/twitter.md`](marketing/twitter.md)
   - 10 tweets, post as a thread
   - Last tweet should link to the HN submission URL (replace `<HN_ID>`)

3. **[9:00 AM PT] Reddit r/QualityAssurance** — [`marketing/reddit-qa.md`](marketing/reddit-qa.md)
   - Wait an hour after HN so you're not spread too thin on replies
   - Flair as "Resource" or "Discussion"

4. **[10:30 AM PT] Reddit r/programming + r/softwaretesting** — [`marketing/reddit-programming.md`](marketing/reddit-programming.md)
   - Same post body, different subs

5. **[afternoon] Dev.to article** — [`marketing/dev-to.md`](marketing/dev-to.md)
   - ~1,500 words, technical deep-dive
   - Post at https://dev.to/new
   - Tags: playwright, testing, ai, claude

6. **[Next Tuesday] Product Hunt** — [`marketing/product-hunt.md`](marketing/product-hunt.md)
   - Separate launch day gives you 2 distribution events instead of 1
   - Prepare the 5 gallery images in advance

7. **[This week] Tool directories** — [`marketing/directories.md`](marketing/directories.md)
   - 2-5 min each, low effort, long-tail SEO
   - Do 3–4 per day across the week

### 4. Respond to every message

For the first 24 hours after Show HN goes live:
- HN comments: reply within 1 hour
- Twitter replies: reply within 15 min
- Reddit comments: reply within 30 min
- GitHub issues: reply within 2 hours

Aggressive response time in the first day drives rank and converts curious visitors into stars/stars into users.

## Things to do while you wait for traffic

- **Add GitHub repo topics** (Settings → Edit repo details → Topics): `playwright testing e2e ai claude anthropic mcp qa-automation self-healing`
- **Verify the Marketplace listing** works: search https://github.com/marketplace for "promptomate"
- **Test the npm global install on a clean machine** (friend's laptop, VM, etc.): `npm install -g promptomate && promptomate quickstart`
- **Close #5 and #10** after you deploy GIF + landing

## What to NOT do today

- Don't add new features. Ship first, iterate second. Feature requests from real users beat speculative builds.
- Don't tweak the landing page copy obsessively. Good enough now > perfect next week.
- Don't start the Phase 3 cloud tier work. That's for next month once you know what paid users want.
- Don't respond to criticism emotionally. Log it as a GitHub issue, say "great point, filed as #N", move on.

## Success looks like

By end of day 1:
- ✅ Landing page live
- ✅ Demo GIF recorded and embedded everywhere
- ✅ Show HN, Twitter, Reddit (3 subs), Dev.to all posted
- ✅ Answered 30+ comments across all channels

By end of week 1:
- 📈 500+ GitHub stars (if HN hit front page) or 100+ stars (if it didn't)
- 📈 50+ weekly active CLIs (check PostHog once you wire a key)
- 🐛 Top 5 real bugs reported by users, fixed same-day
- 💬 A Discord server with ~20 members

## If you don't have time for everything

Priority 1 in order:
1. Deploy landing page
2. Record demo GIF
3. Post Show HN

Nothing else matters as much as those three. If you only do those on launch day, you've done the important work.

Good luck — and reply to this thread when you're back with the results. I'll help you triage comments and fix incoming bugs in real time.

---

_Last updated: 2026-04-18 (night before launch)._
