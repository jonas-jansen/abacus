# Architecture

## Packages

```
packages/
  applet-core   models, parameters, solvers, readouts, linear algebra, axes   (no DOM, no React)
  applet-plot   plot specs → drawing commands for canvas and SVG               (no React)
  applet-ui     React: the applet (formulas, plots, panel, timeline, tools)
  applets       the applet definitions + applets.json (the catalog)            (data, no React)
  channel       messages between containers                                    (no dependencies)
  quiz          React: quiz types, checker display, the notebook
  quizzes       the quiz definitions                                           (data, no React)
site/           Astro: pages, course pages (MDX), layout, themes
```

Three **containers** – applets, quizzes, content – never import each other. They talk through
`@abacus/channel`. `pnpm check:deps` enforces the rules:

| Package | May import | Never |
|---|---|---|
| `applet-core` | – | any `@abacus/*`, React |
| `applet-plot` | `applet-core` | `applet-ui`, quizzes, `channel`, React |
| `applet-ui` | core, plot, `channel` | quiz, quizzes, applets |
| `applets` | core, plot, `applet-ui/define` only | React, the rest of `applet-ui` |
| `quiz` | core, `channel` | anything applet |
| `quizzes` | core, `quiz/define` only | React |
| `site` | everything; `site/src/islands.tsx` is the only place applets and quizzes are looked up | |

Definitions (`applets`, `quizzes`) are plain data and functions. They can be tested without a
browser, and the UI can change without touching them.

## From a parameter change to a picture

```
slider / handle / formula chip / link / channel command
        │  explainChange: parse, clamp, limits (with a reason), normalize
        ▼
params ──► model.run(params, opts) ──► Run { series, grids, field, observables, meta }
        │                                  │
        │                                  ├─► Figure: plotDomains → zoom → makeFrame
        │                                  │      → drawPlot on CanvasSurface (client)
        │                                  │        or SvgPathSurface (server render)
        │                                  ├─► Readouts (observables, marks into the plots)
        │                                  └─► channel: applet/state
        ▼
URL hash (#id.param=value), undo history, sessionStorage
```

- **Model** (`applet-core/model.ts`, `builders.ts`): `run(params, opts)` returns a `Run`.
  The builders `iteration`, `iterationN`, `closedForm` and `ode` cover nearly every applet.
  `opts.detail` asks for a finer run of a zoomed window.
- **Frame** (`applet-core/frame.ts`): pixel geometry of one plot – margins, ticks, the ×10ᵏ
  factor, inverse mappings for the pointer. It is pure, so server and client agree.
- **Plot** (`applet-plot/plots.ts`): `plotDomains`, `drawPlot`, probes and marks per plot
  type. Drawing goes through a small `Surface` interface with two backends: canvas for the
  live picture, SVG for the first paint before hydration.
- **UI** (`applet-ui`): `AppletView` holds the state. `Figure` measures, zooms and draws;
  `FormulaBar` typesets the model with live parameter chips; `controls` builds the panel;
  `Readout` shows measurements; `Timeline` plays steps or time; `Werkzeuge` holds the
  toolbar tools (link, QR, lecture mode, help).

## State

| What | Where | Lifetime |
|---|---|---|
| parameters | URL hash `#<applet>.<param>=<value>&…` (only values that differ from the opening state) | shareable link |
| undo/redo | memory | the visit |
| tempo of the timeline | sessionStorage | the visit |
| settings (hints, values under the pointer, light/dark) | localStorage, mirrored on `<html data-…>` before the first paint | this browser |
| notebook (answers) | localStorage behind the `NotebookStore` interface | this browser, export/import |

Nothing leaves the browser. A server store would plug in behind `NotebookStore`
(`packages/quiz/src/notebook.ts`).

## Channel

`abacus:message` CustomEvents on `window`. The last message per topic and id is kept, so a
container that mounts late still gets the current state.

| Topic | Sent by | Payload |
|---|---|---|
| `applet/state` | applet, after every change | `applet`, `params`, `observables` |
| `applet/command` | anyone | `applet`, `set?`, `reset?` |
| `applet/unlock` | e.g. a prediction quiz | `applet` |
| `quiz/result` | quiz | `quiz`, `value`, `status` |

```js
window.addEventListener('abacus:message', (e) => console.log(e.detail))
```

## Rendering and hydration

Pages are static HTML. An applet is a React island: the server renders its formulas, panel
and an SVG version of each plot at a nominal width. On the client it measures its box, swaps
in a canvas and redraws on every change. Numbers in SVG attributes are rounded so the server
and client markup match. Hint cards (`tip.ts`) are one listener for the whole page, reading
`data-tip` attributes.

## Files worth knowing

| File | Role |
|---|---|
| `packages/applets/applets.json` | catalog: title, chapter, slides, `sichtbar`, order |
| `packages/applets/src/index.ts` | registry; checks catalog and code against each other |
| `packages/applet-ui/src/define.ts` | `defineApplet` and the `AppletDef` type |
| `packages/applet-ui/src/styles.css` | all applet styles; colour tokens at the top |
| `site/src/islands.tsx` | the only place ids become definitions |
| `site/src/layouts/Seite.astro` | page frame, top bar, settings |
| `site/rehype-abschnitte.mjs` | wraps each `##` section of a course page in a card |
| `scripts/` | `new-applet`, `check-deps`, `shoot` (screenshots) |
