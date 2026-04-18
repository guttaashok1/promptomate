# Contributing to Promptomate

Thanks for considering a contribution. This doc covers everything you need.

## Ground rules

1. **Be kind.** See the [Code of Conduct](CODE_OF_CONDUCT.md).
2. **Open an issue first** for any non-trivial change. Saves you writing code that won't land.
3. **Test your change.** `npm run test:unit` must pass (44 tests, ~135ms). If you're touching CLI/command logic, also manually run the affected command.
4. **Keep PRs small.** One logical change per PR. Hard to review otherwise.

## Development setup

```bash
git clone https://github.com/guttaashok1/promptomate.git
cd promptomate
npm install
npx playwright install chromium
cp .env.example .env        # add your ANTHROPIC_API_KEY
```

## Running locally

```bash
npm run dev -- <command>    # tsx-powered, no build step
# e.g.
npm run dev -- list
npm run dev -- serve --port 3535
npm run dev -- explore "..." --url https://...
```

## Tests

```bash
npm run test:unit           # vitest, covers pure helpers (secrets, models, usage, storage)
npm run typecheck           # tsc --noEmit
npm test                    # playwright test — runs the generated specs in tests/
```

Add unit tests to `test/*.test.ts` for any new pure function. Keep them fast (<200ms total).

## Project conventions

Read [CLAUDE.md](CLAUDE.md) — it's the canonical source-map + conventions doc. TL;DR:

- **TypeScript strict, ESM, Node 20+**
- **Lazy-init the Anthropic client** — it reads env vars that dotenv has to load first
- **Record usage after every API call** with `recordUsage(model, response.usage)` — the cost summary is a promise to the user
- **Use `resolveModel(opts.model)`** — don't hardcode model IDs
- **Adaptive thinking on all Opus 4.7 calls**: `thinking: { type: "adaptive" }`
- **Generated specs must not reference MCP at runtime** — MCP refs are ephemeral
- **Semantic locators only** (`getByRole`, `getByText`, `getByLabel`) — CSS selectors are a last resort

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/) encouraged but not enforced:

```
feat: add --max-cost budget guardrail
fix: ensure dotenv loads before Anthropic client instantiation
docs: clarify auth fixture rotation in README
```

Link the issue you're closing: `Closes #42`.

## Pull request process

1. Fork the repo and create a branch: `git checkout -b my-feature`
2. Make your change. Add/update tests.
3. Run `npm run test:unit` + `npm run typecheck`.
4. Push and open a PR against `main`.
5. The CI workflow (Promptomate itself!) will run against the PR.
6. A maintainer will review within ~48 hours during Phases 0–2; faster after.

## What makes a great PR

- ✅ Small, focused change (one feature or one bug fix)
- ✅ Tests added or updated
- ✅ Clear commit message explaining **why**
- ✅ Updated docs if user-visible
- ✅ No new dependencies unless genuinely needed

## Good first issues

Look for the `good first issue` label on [open issues](https://github.com/guttaashok1/promptomate/labels/good%20first%20issue). Areas that often have beginner-friendly tasks:

- Web UI polish (dark mode, model dropdown)
- Documentation
- Additional model aliases or providers
- Expanding the unit test suite

## Security

Found a security issue? **Don't open a public issue.** Email the maintainer at the address on the repo owner's GitHub profile, or use GitHub's private vulnerability reporting.

## Questions?

Open a [discussion](https://github.com/guttaashok1/promptomate/discussions) (once enabled) or ping on [issues](https://github.com/guttaashok1/promptomate/issues).
