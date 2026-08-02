# Contributing

## Workflow

- One branch per feature/fix: `git checkout -b fix/block-offset`, `feat/chicken-mob`, etc.
- Commit messages say **why**, not just what: `fix: align block mesh with collision box (0.5 offset)`.
- Never commit straight to `main`. Open a PR, even solo — it's where the diff gets reviewed.

## Filenames — lowercase only, no exceptions

GitHub Pages serves from Linux, which is case-sensitive; your machine may not be. An import
like `./data/Blocks.js` against a file named `blocks.js` works locally and 404s in production.

Rule: every file and folder under `src/` is `lowercase-with-dashes.js`. No capitals, ever.
(Phase 7 adds a CI check for this — until then, it's an honor rule.)

## Dev server

`file://` breaks ES modules (CORS + module resolution rules), so always serve over HTTP:

```bash
npm run dev
```

This serves from the parent folder on port 3000, so open `localhost:3000/Minicrafter/` — this
matches the `/Minicrafter/` sub-path the site will actually live under on GitHub Pages.

## Tests & formatting

```bash
npm test             # node --test (auto-discovers test/*.test.js)
npm run format       # prettier --write .
npm run format:check # prettier --check . (what CI will run, Phase 7)
```
