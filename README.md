# abacus – interactive applets for sequences and dynamical systems

Implementation of [applet-library-spec.md](applet-library-spec.md).

## Three containers

| Container | Packages | Contains |
|---|---|---|
| **Applet** | `applet-core`, `applet-plot`, `applet-ui`, `applets` | models, solvers, plots, controls, the applet definitions |
| **Quiz** | `quiz`, `quizzes` | question types, checkers, hints, solutions, the local notebook |
| **Content** | `site` | Astro + MDX pages that place applets and quizzes |

Containers never import each other (`pnpm check:deps` enforces it). They talk through
`@abacus/channel` – `abacus:message` events on `window`:

| Message | Sent by | Meaning |
|---|---|---|
| `applet/state` | applet | current parameters and observables, after every change |
| `applet/command` | anyone | set parameters or reset an applet |
| `applet/unlock` | anyone (e.g. a prediction quiz) | show a locked applet |
| `quiz/result` | quiz | an answer was committed, with its status |

The last message per applet/quiz is retained, so containers that load later still get it.
Any script on the page can listen: `addEventListener('abacus:message', e => …)`.

## Pages

- `/` – gallery of all applets, and the course pages
- `/applet/<id>` – explore: one applet, full width
- `/kurs/<seite>` – guided (Gelfand-style): text and quizzes beside the large, sticky applet
- `/notizbuch` – all answers, export/import

## Commands

```sh
pnpm install
pnpm dev                 # http://localhost:4321
pnpm check               # dependency rules + typecheck + tests
pnpm build               # static site in site/dist  (see docs/deployment.md)
pnpm new-applet <id> [--kind iteration|closedForm|ode] [--seite]
node scripts/shoot.mjs <dir> /applet/<id> [--width 390] [--dark]   # screenshots of the dev server
```

## Adding things

**An applet:** `pnpm new-applet newton-cooling --kind closedForm` creates
`packages/applets/src/newton-cooling.ts`, registers it, and it is live at `/applet/newton-cooling`.
An applet is a model (`iteration`, `iterationN`, `closedForm`, `ode`) plus plots and the
observables to display.

Parameter `min`/`max` is only the slider's suggested range – students may type any value, and
the slider stretches. Restrict only where the applet would break, and say why:
`real('Kapazität K', { min: 1, max: 100, step: 1, default: 50, limits: { min: 1e-6, reason: 'K steht im Nenner …' } })`.
Iteration counts: `schritte('Schritte N', { default: 25, max: 80 })` (typed up to 10⁶).
`scale: 'log'` for parameters spanning orders of magnitude. Couplings (`normalize`) are
explained automatically via `constraintNote`.

Everything with a place in the picture should be draggable there. A plot's `drag` takes one
or more handles: `{ param: 'x0', axis: 'y' }` drags a value directly; `at` and `set` let a
handle stand for a derived quantity, e.g. the last point of a sequence setting its slope:
`{ param: 'b', axis: 'y', at: (p) => [p.N, p.x0 + p.b * p.N], set: (_x, y, p) => ({ b: (y - p.x0) / p.N }) }`.
Axes hold still while dragging, values snap to the slider's precision, and the handle and
its slider row light each other up. Iterations and ODEs get a timeline (play, scrub);
closed forms that describe a motion in time opt in with `zeitleiste: true`.

Observables can point into the plots: give them `marks` and the readout highlights that
geometry on hover or click. Labels take `$math$`.
`liste('Fixpunkte $y^*$', xs, { marks: xs.map((v, item) => ({ kind: 'value', v, item })) })` –
`item` ties a mark to one chip. Kinds: `value` (a state value), `time`, `point`, `line`
(through a point with a slope; `in: 'time' | 'map' | 'phase'` says which plot).

**A quiz:** add a `defineQuiz({...})` to a file in `packages/quizzes/src/`. Types: `vorhersage`,
`finde` (`ziel` + `toleranz`, or a `pruefer`), `erzeuge` (predicate on the applet's live state),
`antwort`. Text takes `$math$`. Checkers return a diagnosis with direction and hint.

**A course page:** `site/src/content/seiten/<name>.mdx`. Frontmatter names the page's applet;
write ordinary Markdown prose (lists, tables, `$math$`, `###` subheadings) and use
`<Aufgabe nr={2} titel="…">intro text … <Quiz id="…" /></Aufgabe>` to give an exercise its
own introduction, `<Quiz id="…" schaltetFrei />` (unlocks the applet), `<Definition begriff="…">`,
`<Behauptung>`, `<Beweis>`, `<Spaeter>`, `<Bildluege>`, `<Tipp>`, `<Applet id="…">` for
additional applets. Links like `[a = 3,2](#logistic-cobweb.a=3.2)` set the applet.

## Not yet

Web Worker for heavy runs; nullclines; `<Skizze>`; `<Daten>` (table view); course pages for the
new applets; MATLAB golden fixtures (§12). The answer key (§11.2) is verified in
`packages/applets/src/applets.test.ts`.
