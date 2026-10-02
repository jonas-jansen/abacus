# Writing an applet

An applet is one file in `packages/applets/src/`: a **model** (what is computed) and a
**definition** (formulas, plots, readouts). Everything else – timeline, undo, compare, zoom,
links, hints, chapter listing – comes with it.

```sh
pnpm new-applet konkurrenz --kind ode      # or iteration | closedForm; --seite adds a course page
pnpm dev                                   # → http://localhost:4321/applet/konkurrenz
pnpm test                                  # the checks below run for every applet
```

The template is a complete applet that passes all checks: change it, don't fill it in. Good
models to copy from: `romeo-julia.ts` (planar ODE), `leslie.ts` (matrix iteration),
`newton.ts` (iteration with a construction), `logistic-vergleich.ts` (closed form + steps).

## Anatomy

```ts
const model = ode({
  id: 'konkurrenz',
  params: { r1: real('Wachstumsrate Art 1', { latex: 'r_1', min: 0, max: 2, step: 0.01, default: 1 }), … },
  components: [{ id: 'x', label: 'x(t)', name: 'Art 1' }, { id: 'y', label: 'y(t)', name: 'Art 2' }],
  start: (p) => p.start,
  rhs: (_t, [x, y], p) => [ … ],
  tEnd: (p) => p.T,
  observables: ({ p, series }) => ({ ausgang: klasse('Ausgang', …) }),
})

export default defineApplet({
  id: 'konkurrenz',
  model,
  horizont: 'T',
  formeln: [{ label: 'System', tex: String.raw`x' = {{r1}}\,x\,(1 - …)` }, { label: 'Start', tex: String.raw`(x, y)(0) = {{#start}}` }],
  plots: [{ type: 'phasePlane', xSeries: 'x', ySeries: 'y', field: true, nullclines: true, bahnen: true, drag: { param: 'start', axis: 'xy' } }],
  anzeige: ['ausgang'],
  szenarien: [{ label: 'Folie 26', text: 'what it shows', params: { r1: 0.8 } }],
})
```

Register it in `packages/applets/src/index.ts`, and give it its entry in the catalog
`packages/applets/applets.json` (the scaffold does both):

```json
{"id": "konkurrenz", "sichtbar": false, "kapitel": "IV", "folien": "25–37", "titel": "Konkurrenz zweier Hefearten", "kurz": "Wer verdrängt wen?"}
```

Title, description, chapter and slides live only there; `sichtbar` decides whether the
overview lists it (its address works either way), and the order of the entries is the order within a
chapter. A missing or extra entry fails with a message naming it.

## Models

| Builder | For | Gets | Notes |
|---|---|---|---|
| `iteration` | x₍ₙ₊₁₎ = f(xₙ) | `start`, `step(x, p, n, rng)`, `horizon` | `series` names the orbit; `map` and `tail` in the context |
| `iterationN` | vector iteration | `components`, `start`, `step(x, p, n, rng)`, `horizon` | one series per component |
| `closedForm` | formulas y = f(t) | `domain`, `curves`, `discrete?`, `slope?` | curves go on past the domain when zoomed out |
| `ode` | y′ = f(t, y) | `components`, `start`, `rhs`, `tEnd` | `stiff: true \| 'auto'` (Rosenbrock), `tol`, `hmax` (e.g. shorter than a stimulus), `samples` |

All take `extraSeries(ctx)` (more curves: graphs, constructions, reference lines), `grids(ctx)`
(values over two axes, for heat maps and bar plots per cell) and `observables(ctx)`.
A model written by hand is `defineModel({ …, run(p, opts) })` (see `predator-prey-map.ts`).

**Zoomed plots** ask for a drawing run of their window (`RunOptions.detail`, observables off):
`detail.time` is handled by the builders (sampling window, running past N or T);
`extraSeries` may use `detail.x` (the plot's own x variable: time, state, or a parameter such
as a in a bifurcation diagram) and `detail.y` to recompute what they draw.

## Parameters

| Constructor | Value | Notes |
|---|---|---|
| `real(label, { latex, min, max, step, default, unit?, scale?, limits? })` | number | `min`/`max` are only the slider's range; `limits: { min, reason }` restricts typing, with the reason shown |
| `int(label, { … })` | integer | |
| `schritte(label, { default, max })` | steps N | typed up to 10⁶ |
| `point(label, { latex, xBounds, yBounds, default })` | [x, y] | a start in the plane; `{{#start}}` shows it as a column vector |
| `choice(label, options, default)` | string | options' labels take `$math$` |
| `bool(label, { default, labelOn, labelOff })` | boolean | |

Couplings: `normalize(p)` plus `constraintNote: 'α + γ ≤ 1'`. Restrict inputs only where the
applet would break, and say why.

## Formulas

Every applet states its model above the plots. Each entry is a column (model | start |
solution), lines are separated by `\\` and align at their relation.

| Syntax | Shows |
|---|---|
| `{{a}}` | the parameter: its symbol, or its value in "Werte" mode; draggable, linked to slider and handle |
| `{{+b}}` | a signed term: `+ b` or `− 2` |
| `{{(a)}}` | in brackets when negative |
| `{{#x0}}` | always the value (start values); a point becomes a column vector with a chip per entry |
| `{{*}}` | a product sign that only appears between two numbers |
| `{{z.0}}` | one entry of a point |

The step count or time window named in `horizont` belongs to the timeline, not the formulas.
Numbers are German (`0{,}6`); whole numbers below 10⁷ are written out (`100\,000`).

## Plots

Common options: `title`, `xLabel`, `yLabel` (TeX-lite: `y_n`, `\alpha`, `\text{Anteil}`),
`x`, `y` (a range, `'auto'`, or a function of the parameters), `drag` (handles, below),
`yScale: 'log'`, `logToggle` + `logHilfe` (a lin/log switch with an explanation), `legend: false`.

| `type` | Shows | Own options |
|---|---|---|
| `timeSeriesDiscrete` | values over n | `series`, `connect` |
| `timeSeriesContinuous` | curves over t | `series`, `field` (slope field of a scalar ODE) |
| `functionGraph` | graphs y = f(x) | `series`, `diagonal` |
| `cobweb` | cobweb of an iteration | `f`, `orbit` |
| `phasePlane` | trajectory in the plane | `xSeries`, `ySeries`, `field`, `nullclines`, `bahnen` (click adds a trajectory), `overlay`, `start` |
| `scatter` | point clouds (bifurcation) | `series` |
| `bars` | values at the current step as bars | `series` (one bar each) or `grid` (one bar per row), `share` (fractions) |
| `heatmap` | a grid over time as colours | `grid`, `zLabel`, `zRange` |
| `surface3d` | z = f(x, y), rotatable | `grid`, `zLabel` |

Series carry `label` (TeX symbol) and `name` (what it is: legend shows "y₁ Beute"), `role`
(`primary`, `secondary`, `tertiary`, `reference`, `ghost`, `data`, `annotation`) and may be
`fill` (areas), `arrow` (vectors, labelled at the tip), `dash`, `legend: false`.

**Handles** – everything with a place in the picture should be draggable there:
`drag: { param: 'x0', axis: 'y' }` drags a value; `at(p)` and `set(x, y, p)` let a handle
stand for something derived; `also` lists further parameters it changes; `label` overrides
its TeX label. Axes hold still while dragging, values snap to the slider's precision.

**Zoom and pan** are automatic. Time does not run before its start, and a quantity that is
never negative gets no room below 0.

## Readouts

| Constructor | For |
|---|---|
| `zahl(label, v, { digits, note, marks })` | a number (null = not detected, with a `note` saying why) |
| `index(label, n)` | a count or step |
| `klasse(label, text)` | a category ("stabil", "wird ausgewaschen") |
| `liste(label, values)` | several numbers or texts, one chip each |

Labels take `$math$`. `marks` point into the plots while the readout is hovered:
`{ kind: 'value', v }`, `{ kind: 'time', t }`, `{ kind: 'point', x, y, in: 'time' | 'map' | 'phase' }`,
`{ kind: 'line', x, y, slope, in }`; `item` ties a mark to one chip.

Helpers in `@abacus/applet-core`:

| Function | Gives |
|---|---|
| `verhalten(label, xs)` | "monoton / oszillierend (konvergent)", "divergent" |
| `detectPeriod(tail)`, `periodOf(t, y)` | period of a sequence / of an oscillation in time |
| `fixedPoints(f, a, b)`, `roots`, `bisect`, `events(sol, g)` | fixed points, zeros, crossing times |
| `eigen`, `classify`, `eigenReadout` | 2×2: eigenvalues, type (Sattel, stabiler Strudel …), readout with eigen-directions |
| `eigenvalues(A)`, `spectralRadiusOf(A)`, `eigenvalueTexts` | small n×n matrices (Leslie, compartments) |
| `jacobian(f, x)`, `equilibria2(f, box, 'ode' \| 'map')` | Jacobian; all equilibria in a box with type and stability |

## Scenarios, layout, timeline

- `szenarien: [{ label, text, params }]`: chips above the parameters, each the defaults plus
  `params`. Use them for every setting the slides show.
- `layout: { main: [...], sichtbar: { b: (p) => p.form === 'linear' } }`: which parameters are
  up front, and which only in some settings.
- `zeitleiste: true` gives a closed form a timeline; `schritte: true` opens it at the start.

## Conventions

- Direct manipulation first: handles, formula chips, linked views; no walls of text.
- Vectors are bold (`\mathbf{y}`) everywhere; no "·" as a separator in texts.
- Chapter and slides on every applet (in the catalog); German texts, English code comments.
- Values that come from the slides are checked in `applets.test.ts`.

## Checks

`pnpm test` runs, for every applet: it runs at its defaults and shows only existing
readouts; its formulas render in both modes with every parameter reachable; it runs at the
smallest horizon; and the answer key of the slides. `pnpm build` must stay clean.
