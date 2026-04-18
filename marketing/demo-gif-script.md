# Demo GIF recording script (#5)

Goal: a 60-second GIF showing the three headline capabilities — **explore**, **break**, **auto-heal**. This is the single highest-leverage asset for launch day. It lives in the README hero, the landing page hero, Product Hunt, and every tweet.

## Tools you'll use

- **Recording**: macOS built-in Screenshot (Cmd+Shift+5 → Record Selected Portion) OR [Kap](https://getkap.co/) (free, produces perfect GIFs directly)
- **Terminal**: iTerm2 / Warp / macOS Terminal. Font size 16+. Dark theme.
- **Browser**: Chrome/Arc in a clean profile (no extensions visible)
- **Conversion**: if you record .mov, convert with `ffmpeg -i demo.mov -vf "fps=15,scale=1200:-1" -loop 0 demo.gif` (target 3–5 MB)

## Setup (2 min)

```bash
cd ~/Desktop
mkdir promptomate-demo && cd promptomate-demo
# Install globally so the command line reads "promptomate"
npm install -g promptomate
promptomate init
# Put your ANTHROPIC_API_KEY in .env manually (off-camera)
echo "SAUCE_PASSWORD=secret_sauce" >> .env
# Warm up Playwright
npx playwright install chromium > /dev/null 2>&1
```

## Window layout for recording

- Terminal window on the left (~60% width), dark theme, font 16pt
- Browser window on the right (~40% width), headed mode so viewer sees Chromium in action
- Record the FULL terminal + browser region (Kap → Record Area → drag across both)

## Script (narration in italics, captions overlay in **bold**)

### [0:00 – 0:05] Title card

Blank terminal. Caption overlays:

> **Promptomate: Playwright tests written in English.**

(Just a black frame with text — ffmpeg concat a title card if you want polish, or skip it and let the command be the opening.)

### [0:05 – 0:25] Explore generates a test

Type slowly:

```
promptomate explore --headed "log in as standard_user with password ${SAUCE_PASSWORD} and verify the products page appears" --url https://www.saucedemo.com
```

Press Enter. Viewer sees:

- Terminal streams tool calls: `→ browser_navigate ✓`, `→ browser_fill_form ✓`, `→ browser_click ✓`, `→ browser_snapshot ✓`
- Browser window on the right shows Chromium clicking through the login flow in real-time
- Finally: `✓ Generated tests/log-in-as-standard-user-...spec.ts`
- Cost line: `5 API calls · $0.23`

**Caption overlay**: `Claude drives the browser, then writes the spec.`

### [0:25 – 0:35] Show the generated code

```
cat tests/log-in-as-standard-user-*.spec.ts | head -20
```

Viewer sees real TypeScript with `getByRole`, `fill`, `expect`. This is the "wait, it wrote real code" moment.

**Caption overlay**: `Standalone Playwright. No MCP at runtime. You can edit it.`

### [0:35 – 0:42] Run the test

```
promptomate run log-in-as-standard-user-with-password-sauce-password-and-v
```

(Use tab-completion — viewer sees the long name fill in.)

- Output: `1 passed (1.5s)`

**Caption overlay**: `Passes in under 2 seconds.`

### [0:42 – 0:52] Break it

Simulate a UI change by hand-editing the spec:

```
sed -i '' 's/name: "Login"/name: "Sign In"/' tests/log-in-as-standard-user-*.spec.ts
promptomate run log-in-as-standard-user-with-password-sauce-password-and-v
```

- Output: `1 failed — getByRole('button', { name: 'Sign In' })` … timeout

**Caption overlay**: `Pretend the button got renamed. Test breaks.`

### [0:52 – 1:05] Triage + auto-heal

```
promptomate triage log-in-as-standard-user-with-password-sauce-password-and-v --apply
```

Viewer sees:

- `━━━ Attempt 1/3 ━━━`
- `Verdict: dom_drift · Confidence: high`
- `Reason: The snapshot shows a button named "Login" but the test looks for "Sign In".`
- `Action: healing locators ...`
- `Healed: Updated the login button name from "Sign In" to "Login".`
- `━━━ Attempt 2/3 ━━━`
- `✓ 1 passed (1.2s)`
- `Status: passed · Attempts: 1`

**Caption overlay**: `AI classifies the failure + fixes it. CI knows the difference between a real bug and drift.`

### [1:05 – 1:10] End card

Blank. Caption:

> **Promptomate**
> npm install -g promptomate
> github.com/guttaashok1/promptomate

## Timing note

Aim for **under 75 seconds**. If yours runs longer, trim by:
- Speeding up typing with a script or paste (pre-type commands in a scratch file, paste with Cmd+V for instant fill)
- Cutting the `cat` step (move that to a separate secondary GIF)
- Speeding the video with `ffmpeg -filter:v "setpts=0.75*PTS"` (makes it 33% faster)

## After recording

1. Save as `demo.gif` (3–5 MB target)
2. Add to the repo: `public/demo.gif` and reference from README hero
3. Copy to the landing repo: `promptomate-landing/demo.gif`, replace the GIF slot placeholder
4. Tweet it, attach to HN post URL (you can't attach images to HN submissions — but you can post the GIF as a comment)
5. Use as the cover image on Dev.to and Product Hunt

## If you can't record today

MVP alternative: post an **asciinema recording** (terminal-only, no browser). Instructions:

```bash
brew install asciinema
asciinema rec demo.cast
# run the commands above, headed:false
# Ctrl+D to stop
# upload:
asciinema upload demo.cast  # creates a public URL
```

Embed the asciinema player in your README. Less visceral than a GIF but still way better than nothing. You can record a proper GIF later without re-launching.

## What a good demo looks like

- Real commands, real output (no fakes / Loom cursors)
- Viewer can see *the browser* doing the work (headed mode, right half of screen)
- The "break → triage → heal" beat must be obvious — that's the magic moment
- End card with install command is non-negotiable. Most viewers won't go find your GitHub unless you show the `npm i` command.
