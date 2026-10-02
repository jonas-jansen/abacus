# Operations

## Commands

| Command | Does |
|---|---|
| `pnpm install` | dependencies (pnpm 11, Node 24) |
| `pnpm dev` | dev server at http://localhost:4321; shows unlisted applets and draft pages |
| `pnpm check` | dependency rules + type check + tests (what CI runs) |
| `pnpm test` / `pnpm test:watch` | Vitest, once or watching |
| `pnpm typecheck` | every package and the tests |
| `pnpm check:deps` | the import rules between packages ([architecture.md](architecture.md)) |
| `pnpm build` | static site in `site/dist` |
| `pnpm new-applet <id> --kind iteration\|closedForm\|ode [--page]` | a working applet (and course page), registered and in the catalog, unlisted |
| `node scripts/shoot.mjs <dir> /applet/<id> [--width 390] [--dark]` | screenshots from the running dev server |

## Tests

| Where | What |
|---|---|
| `packages/applet-core/src/*.test.ts` | solvers, parameters, URL codec, readouts, checkers, linear algebra (incl. property tests with fast-check) |
| `packages/applet-plot/src/plot.test.ts` | domains, axes, the ×10ᵏ badge, drawing on the SVG surface |
| `packages/applet-ui/src/zoom.test.ts` | zoom and pan arithmetic |
| `packages/applets/src/applets.test.ts` | **every applet**: runs at its defaults, shows only existing readouts, formulas render in both modes with every parameter reachable, runs at the smallest horizon; the answer key from the slides; catalog and code agree |
| `packages/channel/src/channel.test.ts` | messages, retention |
| `site/tests/*.test.tsx` | the UI in jsdom: formulas, hints, compare, locking and unlocking |

A new applet gets the generic checks automatically. Values it takes from the slides belong in
`applets.test.ts`.

**Visual checks** are part of the work: after a change to the interface, look at it with
`scripts/shoot.mjs` (light and dark, wide and narrow).

## Releasing

Every push to `main` runs `.github/workflows/pages.yml`: `pnpm check`, `pnpm build`, and
publishes to GitHub Pages (https://jonas-jansen.github.io/abacus/). If a check fails,
nothing is published. For your own server see [deployment.md](deployment.md).

## Visibility of applets

Edit `packages/applets/applets.json` (`"visible": true | false`) and push. Unlisted applets
stay reachable by address; course pages marked `draft: true` are not built at all
([course.md](course.md)).

## Kept out of the repository

`apps/` (original MATLAB applets) and `slides/` (lecture PDFs) are in `.gitignore` and must
not be published.

## Course identity

`site/src/config.ts`: `kurs.id`, `kurs.semester` and `kurs.title`. Id and semester are part
of every notebook key; changing them later orphans the answers students have stored.
