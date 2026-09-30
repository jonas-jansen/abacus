# abacus – interactive applets for Mathematik für Biowissenschaften

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

**An applet:** `pnpm new-applet <id> --kind iteration|closedForm|ode` creates a complete
applet in `packages/applets/src/<id>.ts` and registers it; it is live at `/applet/<id>`.
The guide – models, parameters, formula syntax, plot types, handles, readouts, scenarios and
the checks every applet passes – is **[docs/applets.md](docs/applets.md)**.

For students, every applet offers undo/redo, "vergleichen" (hold a state, drawn faintly),
zoom and pan (curves continue past N and T), shareable links, scenario chips from the slides,
and hint cards that can be switched off for teaching (settings in the top bar).

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

Web Worker for heavy runs; `<Skizze>`; `<Daten>` (table view); course pages for the
new applets; MATLAB golden fixtures (§12). The answer key (§11.2) is verified in
`packages/applets/src/applets.test.ts`.
