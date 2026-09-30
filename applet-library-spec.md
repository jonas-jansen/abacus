> **Historical:** the original specification the library was built from. Where it and the code
> differ, the code and [docs/applets.md](docs/applets.md) are current.

# Interactive Applet Library — Design Specification

**Project.** A TypeScript library for building interactive mathematical applets, and a
German-language course website that uses it. The initial content is a port of 23 MATLAB
App Designer applets on sequences, difference equations, ODEs and dynamical systems.

**Pedagogical model.** Israel Gelfand's correspondence school (ВЗМШ). The design
consequences of that choice are stated in §1 and are binding on the architecture — they
are the reason several things below look more elaborate than "plot with sliders".

**Status.** Specification. No implementation yet. Type signatures below are *declarations*
fixing interfaces, not code to be copied.

---

## Contents

1. [Pedagogical requirements](#1-pedagogical-requirements)
2. [Decisions already taken](#2-decisions-already-taken)
3. [Package architecture](#3-package-architecture)
4. [`applet-core`](#4-applet-core)
5. [`applet-plot`](#5-applet-plot)
6. [`applet-ui`](#6-applet-ui)
7. [MDX authoring vocabulary](#7-mdx-authoring-vocabulary)
8. [Checking and feedback](#8-checking-and-feedback)
9. [Persistence — the notebook](#9-persistence--the-notebook)
10. [Applet definitions](#10-applet-definitions)
11. [The 23 applets: mapping and answer key](#11-the-23-applets-mapping-and-answer-key)
12. [Testing](#12-testing)
13. [Build order](#13-build-order)
14. [Open items](#14-open-items)

---

## 1. Pedagogical requirements

These are requirements, not aspirations. Each one has a named architectural consequence.

| Principle | Consequence |
|---|---|
| The applet is an instrument for a problem, not an illustration | Applets must be **gateable**: a page can withhold the plot until the student commits a prediction. Reveal state is a first-class concept in `applet-ui`. |
| The student produces something and keeps it | A **local notebook** captures every answer, sketch and found value, exportable and importable. Retrofitting this is a rewrite of every page, so it ships in v1. |
| Very small steps, honestly numbered | Posing a six-line problem must cost six lines. This is why authoring is MDX (§7). |
| Concrete before general | The applet is usually *not* the first element on a page. Page skeleton in §7.3. |
| No hiding the difficulty | Starred problems, and a standard `<Bildluege>` block for where the numerics or finite $n$ misleads. |
| The verdict comes from mathematics, not the machine | `<Finde pruefung="spaeter">`: the student commits a value, and it is confronted with the *proof* later, not with an instant tick. |
| Never just "wrong" | Checkers return a structured diagnosis with direction and a nudge, never a boolean. §8. |

---

## 2. Decisions already taken

| Area | Decision |
|---|---|
| Site framework | **Astro** with React islands. Static output. |
| Plot rendering | **Hybrid**: SVG axes/labels/annotations, canvas data layer. |
| Persistence | **Local only**, exportable and importable. No backend, no personal data leaves the device, no DSGVO obligations. |
| Authoring | **MDX** — German prose plus components. |
| Language | English identifiers in code; all user-facing strings German, in per-applet dictionaries. i18n seam present, only `de` populated. |
| Licence | Library MIT; content CC-BY-SA. |
| Skript export | Not required. The SVG backend is kept anyway for SSR first paint (§5.3). |
| Mobile | First-class target, not an afterthought. §6.2. |

---

## 3. Package architecture

```
applet-core     parameters, couplings, models, solvers, observables,
                seeded RNG, frame/scales, state + URL codec
                → no DOM, no React, SSR-safe

applet-plot     renderers: surfaces, layers, plot types
                → DOM, but no knowledge of parameters or models

applet-ui       React: controls, layout, notebook, gating,
                prediction and checking blocks

applets         the 23 + new ones. Pure definitions: data and
                functions only. No components.

site            Astro + MDX content (German)
```

**Dependency rule, strictly enforced.** `applet-core` imports nothing from the other three
and touches no DOM API. This is what makes models unit-testable, cheap to call in a loop
for sweeps, and renderable server-side.

**Second rule.** Adding a new applet must require touching `applets` only. If it requires
a change in `applet-ui`, the abstraction has failed and the change belongs in `applet-ui`
as a general capability.

---

## 4. `applet-core`

### 4.1 Parameter schema

```ts
type ParamSpec =
  | { kind: 'real';   id: string; label: string; latex?: string
      min: number; max: number; step: number; default: number
      unit?: string; fine?: boolean }              // fine mode allowed, default true
  | { kind: 'int';    id: string; label: string; latex?: string
      min: number; max: number; default: number }
  | { kind: 'choice'; id: string; label: string
      options: { value: string; label: string }[]; default: string }
  | { kind: 'bool';   id: string; label: string
      labelOn: string; labelOff: string; default: boolean }
  | { kind: 'point';  id: string; label: string   // draggable initial condition
      xBounds: [number, number]; yBounds: [number, number]
      default: [number, number] }
```

`step` is the arrow-key increment, not a hard quantisation; typed values may be finer.

### 4.2 Couplings

Several models have constrained parameter sets. The MATLAB originals enforced these
imperatively inside every callback, duplicated five times per app. Here it is one
declarative projection:

```ts
normalize?: (p: Params) => Params
constraintNote?: string   // shown to the student, e.g. "α + γ ≤ 1"
```

**Law: `normalize` must be idempotent.** `normalize(normalize(p)) === normalize(p)`.
Property-tested (§12). It is applied once, centrally, after every parameter change and
after URL decoding.

Known cases: `SIR` needs $\alpha+\gamma\le1$ and $x_1(0)+x_2(0)=N$; `recursive_sqrt2`
must exclude $x_0=0$.

### 4.3 Models

Three kinds, one interface:

```ts
type ModelKind = 'iteration' | 'closedForm' | 'ode'

interface Model {
  id: string
  kind: ModelKind
  params: ParamSpec[]
  normalize?: (p: Params) => Params
  run(p: Params, opts: RunOptions): Run
}

interface RunOptions {
  horizon: number          // n_max for iterations, t_end for continuous
  samples?: number         // for closedForm / dense output
  seed?: number
  tol?: number             // solver tolerance
}

interface Run {
  series: Series[]
  observables: Record<string, Observable>
  meta: { solver?: string; steps?: number; warnings?: string[] }
}
```

`run` must be **pure** — same input, same output, no globals, no `Date`, no unseeded
randomness.

### 4.4 Series

```ts
interface Series {
  id: string
  label: string
  kind: 'discrete' | 'continuous'
  x: Float64Array
  y: Float64Array
  role: SeriesRole        // see palette, §5.5
}
```

Typed arrays, so the canvas layer can walk them without allocation.

### 4.5 Observables

The mechanism that turns an applet into a problem with an answer.

```ts
interface Observable {
  value: number | string | null      // null = not detected
  kind: 'zahl' | 'index' | 'klasse' | 'liste'
  label: string
  format?: (v: unknown) => string
  tol?: number        // detection tolerance used
  note?: string       // e.g. "keine Periode ≤ 16 gefunden"
}
```

`null` is meaningful and must not be conflated with `0`: a period-detection observable
returning `null` is the signal for chaotic behaviour, and the `note` explains the limits
of the detection.

**Required observables by model family.**

*Scalar iterations* — `fixpunkte` (roots of $f(x)-x$ with $f'$ at each), `periode` (eventual
period of the tail: 1, 2, 4, 8, … or `null`), `grenzwert`, `verhalten`
(`monoton` | `oszillierend` | `divergent`, from the sign pattern of tail differences),
`maximum`, `argmax`, `ersterIndexMit(bedingung)`, and for `recursive_sqrt2`
`korrekteStellen[]` per step.

*Continuous scalar* — `gleichgewicht`, `halbwertszeit` / `verdopplungszeit`, `wendepunkt`,
`zeitBis(schwelle)`, `rmsFehler` (data-fitting only).

*Planar linear* — `spur`, `determinante`, `eigenwerte`, `typ`
(`stabiler Knoten` | `instabiler Knoten` | `Sattel` | `stabiler Strudel` |
`instabiler Strudel` | `Zentrum` | `entartet`), `eigenrichtungen`, `umlaufzeit`.
Discrete variants add `spektralradius`.

*Two-component nonlinear* — `gleichgewichte`, `peakWert`, `peakIndex`, `endzustand`,
`wachstumsfaktor0`, `koexistenz`, `periode`, `phasenverschiebung`.

*Numerics* — `globalerFehler` per method, `ordnung`, `stabil` (boolean),
`oszillationsfrei` (boolean).

*MM* — `erhaltung.EC`, `erhaltung.SCP` (drift from constant — itself a numerics lesson),
`maxC`, `tMaxC`, `v0`.

### 4.6 Sweeps

Some of the best questions need a family of runs, not one. Two tiers:

```ts
sweep1d(model, p, paramId, values, extract: (r: Run) => number): Point[]
sweepTail(model, p, paramId, values, opts): Point[]   // bifurcation diagrams
```

This is the reason `run` must be cheap and pure. Uses: order of convergence (halve $h$
repeatedly), the logistic bifurcation diagram, the Michaelis–Menten $v_0$ against $S_0$
response curve.

### 4.7 Solvers

| Solver | Requirement |
|---|---|
| `rk45` | Dormand–Prince, adaptive step, **dense output**. Dense output is required — both for smooth plotting at arbitrary zoom and for event root-finding. |
| `rosenbrock` | ROS3P or RODAS3, numerical Jacobian. **Required by `app_MM`**, where $k_1=10^6$ against $k_3=0.1$. An explicit method will crawl or fail there. Do not ship v1 without it. |
| `events` | Root-finding on scalar $g(t,y)=0$ over dense output. Required for `halbwertszeit`, `zeitBis`, `wendepunkt`. Without it these observables are computed by scanning samples and are inaccurate by up to one sample spacing. |

ODE models declare `stiff: true | false | 'auto'`.

### 4.8 Seeded randomness

`app_logistic_a_perturbation` uses `rng(5)`. If the perturbation differs per student, the
text cannot say "look at $n=14$". A seeded PRNG (PCG32 or xoshiro128\*\*) lives in core;
the seed is part of `RunOptions` **and** of the URL state.

### 4.9 State and URL codec

Format: `#<appletId>.<paramId>=<value>&<appletId>.<paramId>=<value>`

Always namespaced by applet id, even when a page has only one — this costs nothing now
and avoids a migration the first time a page has two.

Requirements: numbers serialised at fixed significant digits; decoding runs through
`normalize`; round-trip is property-tested. Enables prose like
*"vergleichen Sie [dies](#logistic-map.a=2.9) mit [dem](#logistic-map.a=3.2)"*, which is
the highest-leverage small feature in the design.

---

## 5. `applet-plot`

### 5.1 The coordinate contract

One `Frame`, built in core, read by both layers. Neither layer computes its own scales.

```ts
interface Frame {
  width: number; height: number
  margin: { top: number; right: number; bottom: number; left: number }
  plot: { x: number; y: number; w: number; h: number }   // the data rectangle
  xScale: (v: number) => number      // data → px, plot-area coordinates
  yScale: (v: number) => number
  xInvert: (px: number) => number
  yInvert: (px: number) => number
  xTicks: number[]; yTicks: number[]
}
```

**Layout rule that removes most of the pain:** the canvas element is sized to the `plot`
rectangle exactly, not the whole figure. Canvas pixel coordinates then equal plot-area
coordinates with no margin offset to keep in sync, and clipping at the axes is free
because it is the element boundary.

Margins depend on label widths, and text measurement needs the DOM — which SSR does not
have. Resolution: core estimates label width as `chars × fontSize × 0.6`. Deliberately
conservative, and identical on server and client so the two agree.

### 5.2 Layer sandwich

| Layer | Content |
|---|---|
| SVG (bottom) | grid, axes, ticks, tick labels, axis labels |
| Canvas (middle) | all data geometry. `pointer-events: none` |
| SVG (top) | annotations, draggable handles, readouts, tooltips, legend |

The top SVG is what makes direct manipulation pleasant: crisp text and real DOM
hit-testing for handles, while the curve stays on canvas.

Resize through a single `ResizeObserver` → recompute `Frame` → both layers redraw on the
next animation frame. Canvas backing store capped at **2× DPR** (Android devices report 3×,
which is nine times the pixels for no visible gain).

### 5.3 The `Surface` interface

The data layer must not talk to `CanvasRenderingContext2D` directly. It draws through:

```ts
interface Surface {
  begin(style: StrokeStyle): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  dot(x: number, y: number, r: number): void
  polygon(pts: Float64Array): void
  end(): void
}
```

Two implementations: `CanvasSurface` (screen) and `SvgPathSurface` (SSR first paint,
print, and future figure export). Same geometry code, two emitters.

**Rule: `Surface` draws geometry only. All text lives in the SVG layers.** This keeps the
two backends trivially equivalent.

Although figure export for the LaTeX slides is not required, the SVG backend is kept: it
lets Astro server-render a static first frame, so on a slow mobile connection the student
sees the plot before the island hydrates rather than an empty box.

### 5.4 Plot types

| Type | Notes |
|---|---|
| `TimeSeriesDiscrete` | dots plus optional dashed connector (matches the MATLAB house style) |
| `TimeSeriesContinuous` | curve from dense samples |
| `PhasePlane` | trajectory, start marker, optional direction field and nullclines, draggable initial condition |
| `Cobweb` | **new.** $f$, the diagonal, the staircase, draggable $x_0$, step-by-step advance |
| `FunctionGraph` | $f(x)$ with optional diagonal, tangent, reference lines |
| `Surface3D` | $z=f(x,y)$ on a grid; canvas only; painter's algorithm; colormap. Required by `predator_prey_updatefun` |
| `Bifurcation` | **new.** parameter against tail values; canvas; many points |
| `Overlay` | two parameter sets compared, one drawn as a ghost |

The three marked new or required are the ones that turn demonstrations into arguments.
The cobweb in particular is one step from what `updatefunction_logistica` already draws,
and it is what makes $|f'(y^*)|<1$ obvious rather than asserted.

### 5.5 Palette and accessibility

Series carry a **role**, not a colour: `primary`, `secondary`, `tertiary`, `reference`
(exact solution), `ghost`, `annotation`, `grid`.

- Colour-blind safe. **The MATLAB red/green pairing used in `SIR` and `predator_prey` is
  the worst case for the commonest deficiency and must not be carried over.** Blue /
  orange / purple.
- Every series must be distinguishable by marker shape or dash pattern as well as colour.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for lines against background.
- `prefers-reduced-motion` respected by every animation.

### 5.6 Responsive frame

Tick density, margins and label font are **derived from width, never constant**. The
MATLAB apps set `XTick = 0:1:80`, which is unreadable even on a laptop.

- ≈ one x-tick per 60 px, one y-tick per 40 px, snapped to a 1–2–5 ladder.
- Index axes ($n$) snap ticks to integers.
- At < 400 px: abbreviate labels, drop the axis title if the tick labels carry the unit.
- Minimum legible font 11 px; below that, drop labels rather than shrink.

---

## 6. `applet-ui`

### 6.1 Control model

**No knobs.** A knob is imprecise, hard to keyboard, and hides the number. The control
model is *value + range + step + fine mode*, rendered differently per breakpoint.

`Slider` requirements:

- visible numeric value and an editable numeric field
- arrow keys step by `step`; Shift+arrow by 10×; Alt/Option by `step`/10
- ± stepper buttons, always present on touch
- **Feinmodus**: narrows the slider range to $[v-\delta, v+\delta]$ with
  $\delta=(\max-\min)/20$, recursively, with a breadcrumb of the current window and a
  reset.

Fine mode exists because fingers cannot dial $a$ to $3.5699$ — but it is also
pedagogically valuable in its own right: a control that zooms into parameter space makes
the self-similarity of the bifurcation cascade something the student *does*. Desktop gets
it too.

Other controls: `Switch`, `Choice`, `Toggle`, `PointHandle` (on-plot drag).

**`StepControl`** — for iteration models, advance $n$ one step at a time. Watching a
cobweb draw itself step by step is worth more than seeing 30 points at once. This should
be the default presentation for iterations, with "alle Schritte" as the alternative.

`PlayButton` sweeps a parameter; respects `prefers-reduced-motion`.

### 6.2 Mobile

Breakpoints: `< 640` stacked · `640–1024` stacked, wider · `> 1024` side by side.

- Controls **beneath** the figure when narrow, **beside** it when wide.
- At most two or three controls visible; the rest in a collapsed *"weitere Parameter"*
  drawer.
- Figure aspect: 4:3 narrow, 16:10 wide; **phase plots always 1:1**. Minimum height 240 px.
- **Touch and scroll.** Handles get ≥ 44 px targets. `touch-action: none` on the plot
  element only. A drag that starts outside a handle must scroll the page. Getting this
  wrong traps the scroll, which is the commonest way an applet becomes unusable on a
  phone — treat it as a release blocker.
- `<Skizze>` is better on touch than with a mouse. Lean into it.

### 6.3 Data view

`<Daten>` renders the current series as a table. Virtualised above 200 rows, in a
horizontal-scroll container, with a copy button. Cheap, aids accessibility, and lets a
student check a hand computation against the applet — which is exactly the intended use.

---

## 7. MDX authoring vocabulary

German names, since they will be typed a hundred times. This list should be frozen before
page writing starts; renaming later is painful.

### 7.1 Blocks

| Component | Key props | Role |
|---|---|---|
| `<Applet>` | `id`, `zustand`, `gesperrtBis` | the instrument; `zustand` sets opening parameters, `gesperrtBis` gates on a prediction id |
| `<Aufgabe>` | `nr`, `stern` | a numbered problem |
| `<Vorhersage>` | `id`, `frage` | commit an answer; unlocks what follows |
| `<Finde>` | `groesse`, `ziel`, `toleranz`, `pruefung` | find a number (§8) |
| `<Erzeuge>` | `bedingung` | configure the applet until a predicate holds (§8) |
| `<Antwort>` | `id` | free text → notebook |
| `<Skizze>` | `id`, `achsen` | draw the expected graph before seeing it |
| `<Tipp>` | `stufe` | hint ladder, progressive |
| `<Loesung>` | — | revealed only after an attempt is recorded |
| `<Behauptung>` / `<Beweis>` | — | the seen → proved transition |
| `<Spaeter>` | `woche` | honest deferral: "das beweisen wir in Woche 7" |
| `<Bildluege>` | — | where the picture misleads |
| `<Daten>` | `applet` | table view of the current series |

`voraussetzungen` and `fuehrtZu` live in page **frontmatter**, not as components. They
build the dependency graph that becomes the site's front page.

### 7.2 The two that carry the pedagogy

`<Vorhersage>` is the gate that stops an applet being a demo.

`<Erzeuge>` is the inverse problem — *"Stellen Sie $A$ so ein, dass ein Sattel
entsteht"* — and is the richest type, because there is no single right answer and the
student must reason about what each parameter does rather than sweep a slider.
`app_log_IVPdata` is already exactly this; it just never says so.

### 7.3 Canonical page skeleton

Fixed for all pages, so the student learns the rhythm.

1. **Frage** — one concrete sentence, no formalism.
2. **Mit Papier** — 2–3 problems done by hand *before the applet exists on the page*.
3. **Das Werkzeug** — the applet, introduced with an explicit "move this, watch that".
4. **Vorhersage** — committed; the reveal is gated on it.
5. **Aufgaben** — numbered, small, increasing, some starred.
6. **Vom Bild zur Behauptung** — state what was seen as a conjecture, then prove it, set it
   as a problem, or defer it explicitly. Never let the picture stand in for the proof
   silently.
7. **Wo das Bild lügt** — finite $n$, floating point, shadowing, step size.
8. **Weiterdenken** — one question, no answer given.

---

## 8. Checking and feedback

### 8.1 Question types

| Type | Student submits | Checked against |
|---|---|---|
| **Schwelle** | a number in parameter space | target ± tolerance |
| **Ablesen** | a number or index in state space | observable ± tolerance; integers exact |
| **Klassifizieren** | one of a closed set | computed `klasse` observable |
| **Erzeuge** | the applet configuration | predicate over params and observables |

The first three are `<Finde>`, the fourth `<Erzeuge>`.

### 8.2 The diagnosis contract

**Checkers return a diagnosis, never a boolean.**

```ts
interface Diagnose {
  status: 'richtig' | 'nah' | 'falsch' | 'gespeichert'
  richtung?: 'zu klein' | 'zu groß'
  hinweis?: string
}

type Pruefer = (eingabe: unknown, p: Params, o: Observables) => Diagnose
```

So the response can be *"zu klein — bei $a=2.8$ läuft die Folge immer noch auf einen
einzigen Wert zu"* rather than a red cross. The direction and kind of error must be
available to the checker; that is why it receives parameters and observables, not just
the submitted value.

### 8.3 Modes

| `pruefung` | Behaviour |
|---|---|
| `sofort` | immediate diagnosis. For small questions. |
| `spaeter` | the value is stored and confronted with the **proof** later in the page or in a later week. The verdict comes from mathematics, delayed, not from the browser, instantly. **Default for the headline question on a page.** |
| `keine` | recorded only. |

Tolerances are generous and **stated to the student** ("auf 0.1 genau"). Attempts are
unlimited and all of them are recorded — the student's own sequence of guesses is the
interesting artefact, not the final answer.

---

## 9. Persistence — the notebook

### 9.1 Schema

```
key:   vzms:<kurs>:<semester>:<seite>:<block>
value: {
  v: number                 // schema version of this entry
  typ: 'antwort' | 'vorhersage' | 'finde' | 'erzeuge' | 'skizze'
  eingaben: { wert: unknown; ts: number; status: Diagnose['status'] }[]
  notiz?: string
  skizze?: string           // data URL
}
```

Plus an index document listing all keys for the aggregate view.

**Block ids are author-assigned and stable, never positional.** If ids were positional,
inserting a problem in week 3 would silently reassign every stored answer below it. This
is worth a lint rule.

The `v` field lets you decide, when a problem is reworded, whether to keep or invalidate
the stored answer.

### 9.2 Export and import

- **Export** produces two artefacts: a JSON blob for re-import, and a readable
  Markdown/PDF transcript restating the problems with the student's answers. The second is
  what stands in for the letter home.
- **Import** matters more than it sounds. `localStorage` is per-browser-per-device, and a
  student who loses four weeks of work will not come back.
- Visible *"Fortschritt exportieren / importieren / zurücksetzen"* on every page, plus a
  `/notizbuch` page aggregating everything.

### 9.3 What the site must say plainly

This is a private notebook. Nobody sees it, nothing is graded, and nothing is transmitted.
`<Finde>` can tell a student *this value works*; it cannot tell them *your reasoning was
right*.

---

## 10. Applet definitions

What an author writes in `applets`, and nothing more:

```ts
interface AppletDef {
  id: string
  titel: string                  // de
  kurz: string                   // de, one line
  model: Model
  plots: PlotSpec[]
  layout?: LayoutHint            // control grouping, drawer contents
  anzeige?: string[]             // observable ids to display live
  seite?: string                 // the page it belongs to
}
```

**Island boundary rule: one parameter set, one island, however many plots it drives.**
`linearsystem_phase` — time series *and* phase plane from the same $A$ — is one island
with two figures, not two islands sharing state. This removes the need for any
cross-island store.

Hydration: `client:visible` for applets below the fold; `client:load` only for one at the
top of a page.

Prose math renders at build time via `remark-math` + `rehype-katex` — static HTML plus one
stylesheet, zero runtime JS. Axis labels inside the running applet use **Unicode**
(`xₙ`, `yₙ`, `α`, `β`, `γ`, `Δ`), which covers everything in this collection, rather than
dragging KaTeX into the render loop.

---

## 11. The 23 applets: mapping and answer key

### 11.1 Model kinds

| Applet | Kind | Notes |
|---|---|---|
| `arithmetric` | closedForm | $x_n = x_0 + bn$ |
| `geometric` | iteration | $x_{n+1}=ax_n$ |
| `newton_cooling` | closedForm | $T_n=(T_0-T^u)(1-\alpha)^n+T^u$ |
| `recursive_sqrt2` | iteration | Heron |
| `logistic_rK` | iteration | $x_{n+1}=x_n+r(1-x_n/K)x_n$ |
| `logistic_a` | iteration | $y_{n+1}=ay_n(1-y_n)$ |
| `logistic_a_perturbation` | iteration | **seeded noise** |
| `updatefunction` | closedForm | graph of $f$ only |
| `updatefunction_logistica` | closedForm | graph + diagonal → **cobweb** |
| `SIR` | iteration (2d) | |
| `predator_prey` | iteration (2d) | |
| `predator_prey_updatefun` | closedForm (2d) | **Surface3D** |
| `linearsystem_phase_discrete` | iteration (2d) | |
| `exp_IVP` | closedForm | |
| `linear_diff` | closedForm | general solution |
| `linear_IVP` | closedForm | IVP |
| `log_IVP` | closedForm | |
| `log_IVPdata` | closedForm + data | **`rmsFehler`** |
| `linearsystem` | ode | non-stiff |
| `linearsystem_phase` | ode | non-stiff, two figures one island |
| `RJ` | ode | identical model to `linearsystem`, relabelled |
| `MM` | ode | **stiff — requires Rosenbrock** |
| `numdiffsol` | ode + methods | Euler and Heun implemented explicitly, plus exact |

Note: `RJ` and `linearsystem` are the same model with different labels. One `Model`, two
`AppletDef`s.

### 11.2 Candidate answer key

Derived analytically. **Verify numerically once the models exist** before writing these
into pages.

| Applet | Question | Answer |
|---|---|---|
| `geometric` | where growth starts | $a=1$ |
| `newton_cooling` | approach stops being monotone / diverges | $\alpha=1$ / $\alpha=2$ |
| `logistic_rK` | monotone lost / limit $K$ lost | $r=1$ / $r=2$, since $f'(K)=1-r$ — **independent of $K$** |
| `logistic_a` | fixed point loses stability / 4-cycle appears | $a=3$ / $a=1+\sqrt6\approx3.449$ |
| `logistic_a` | accumulation of the cascade | $a\approx3.5699$ |
| `predator_prey` | smallest $\gamma$ with the predator surviving | $\gamma=1$, since $y_2^*=r(1-1/\gamma)/\gamma$ |
| `SIR` | epidemic takes off | $\beta x_1(0) > \gamma+\alpha$ |
| `numdiffsol` | Euler stable / Euler oscillation-free | $m\ge4$ / $m\ge7$, from $\lambda=-0.6$, $h=10/m$ |
| `recursive_sqrt2` | correct digits per step | roughly doubles |

**The `logistic_rK` row deserves a page of its own.** The student expects the threshold to
depend on $K$, discovers experimentally that it does not, and then the proof
($f'(K)=1-r$) explains exactly why. That is the intended shape of every page in this
course.

**The `numdiffsol` pair is almost certainly why the $m$ knob starts at 1** — both
thresholds sit inside its range, and the original app never asks about either.

---

## 12. Testing

| Layer | Approach |
|---|---|
| Models | **Golden tests against the MATLAB output.** Generate 5 parameter sets per model in MATLAB once, freeze as fixtures. This is the cheapest possible guarantee that the port is faithful. |
| Solvers | Against analytic solutions; measured order of convergence for `rk45` and `rosenbrock`. |
| `normalize` | Property test: idempotence, and range preservation. |
| URL codec | Property test: round-trip through `normalize`. |
| Observables | Period detection on known cases: $a=2.5\to1$, $a=3.2\to2$, $a=3.5\to4$, $a=3.9\to$ `null`. |
| Frame | Tick generation at widths 320 / 768 / 1440; SSR and client margins agree. |
| Rendering | Playwright visual regression per applet at three widths. |
| Accessibility | `axe` on every page; keyboard-only traversal of every applet; scroll-not-trapped test on touch. |

---

## 13. Build order

A vertical slice of four applets that between them exercise every part of the
architecture. If these four work, the remaining nineteen are content, not engineering.

| # | Applet | What it proves |
|---|---|---|
| 1 | `geometric` | the whole pipeline end to end on a trivial iteration |
| 2 | `log_IVP` | closed form, three coupled parameters, continuous curve, responsive frame |
| 3 | `updatefunction_logistica` → cobweb | the first genuinely new plot type; `<Vorhersage>`, `<Finde>`, `<StepControl>`, direct manipulation |
| 4 | `MM` | stiff solver and the Web Worker escape hatch, while changing course is still cheap |

Only after all four: the MDX vocabulary is frozen, then content writing begins.

---

## 14. Open items

1. **Course details** — name, semester, module, target audience, which weeks map to which
   applets. Needed before the dependency graph and front page can be designed.
2. **Hosting** — university web space or GitHub Pages; URL structure.
3. **Worker policy** — currently proposed only for `MM`. Decide whether to make it general
   with a synchronous fast path.
4. **Whether `<Erzeuge>` predicates need authoring in MDX** or can live in the applet
   definition. Leaning towards the applet definition, referenced by name from MDX.
5. **Existing LaTeX slides** — whether any figures should eventually be generated from the
   same models (the SVG backend makes this possible but it is not currently required).
