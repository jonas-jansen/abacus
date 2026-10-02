# Modularity audit – 2 October 2026

**Verdict: modular.** An applet is still one file of data and functions plus one catalog
line, and the boundaries between packages hold. The library's weak spot is the plot type: a
new one touches several places. The bundle loads every applet on every page.

## What was checked

| Question | Finding |
|---|---|
| Do the package boundaries hold? | Yes. `pnpm check:deps` passes. No applet or quiz imports React or the UI. Applets and quizzes meet only in `site/src/islands.tsx`. |
| How much is an applet? | One file (40 applets, 52–186 lines, median 90) plus one entry in `applets.json`. Their logic uses the core API only (`real` in 38 files, `zahl` 32, `klasse` 22, `liste` 15; a builder or `defineModel` in every one). |
| Does the scaffold work? | Yes, for all three kinds. Verified by generating an `ode`, an `iteration` and a `closedForm` applet (with course page): each typechecks, passes the 5 automatic checks at once, and renders. |
| Is shared logic shared? | Yes. Functions to choose from (`funktionen.ts`), readout helpers (`verhalten`, `periodOf`, `eigenReadout`, `equilibria2`) and checkers live in one place. The only repetition: a 1-line matrix-entry parameter helper in 4 applets. |
| Can the UI change without touching applets? | Mostly. Plot cards, toolbar, lecture mode, themes and plot sizing touched no applet file; readouts as vectors needed one option (`form: 'vektor'`, `namen`) in the applets that use it. |
| Can the look change without code? | Yes, since this release: colours are a theme file of `--ci-*` variables ([design.md](design.md)). |

Sizes (lines, without tests): `applet-core` 2 480, `applet-plot` 2 000, `applet-ui` 3 800,
`channel` 105, `quiz` 720, definitions (`applets` 3 800, `quizzes` 180).

## Fixed during the audit

- `AppletView.tsx` had grown to 840 lines, holding state, readouts, timeline, tempo and the
  copy button. Split into `AppletView` (state and layout, 419), `Readout`, `Timeline` and
  `Werkzeuge`. Behaviour unchanged (tests, browser sweep of all applets).
- An unused import in `axes.ts`; a wrong path in `deployment.md`.
- Documentation: from three files to a set ([README.md](README.md)).

## Recommendations, by value

1. **One registry entry per plot type.** Today a plot type is spread over `plotDomains`,
   `drawPlot`, `overlay.ts`, `isSquare`, `legendEntries` and `Figure` (time axis or not);
   [extending.md](extending.md#a-plot-type) lists the 8 steps. One object per type
   (`{ domains, draw, probe, legend, square, timeAxis }`) would make it one file, and split the
   794-line `plots.ts` along the way. *Do it with the next new plot type.*
2. **Load applets on demand.** All 40 definitions are in one bundle (≈ 85 KB gzipped, on top
   of React and KaTeX ≈ 150 KB) on every page. A registry of `() => import('./krebs')` would
   load only the page's applet. *Worth it beyond ~60 applets, or for phones on slow networks.*
3. **A `useAppletModel` hook.** `AppletView` still holds about 25 pieces of state (parameters,
   history, run, detail runs, compare, trajectories, focus). Moving the model side into a
   hook would leave a view component, and make the state testable without rendering.
4. **Heavy runs off the main thread.** Bifurcation diagrams and stiff models run in the page.
   They are fast enough today; a Web Worker behind `model.run` would keep the interface
   smooth for larger ones.
5. **Interface texts in one place.** German labels ("rückgängig", "Messwerte", hint texts)
   are inline in `applet-ui`. Collected in one module, a second language becomes a file.
   *Only if needed.*
6. **`matrixEintrag(min, max, step)`** in core for the repeated helper. *Trivial.*

## How to repeat this audit

```sh
pnpm check:deps                                       # boundaries
pnpm new-applet audit-x --kind ode && pnpm check      # scaffold end to end (then remove it)
find packages -name '*.ts*' -not -name '*.test.*' -path '*/src/*' | xargs wc -l | sort -n | tail
grep -c "spec.type ===" packages/applet-ui/src/*.tsx  # plot-type special cases in the UI
```
