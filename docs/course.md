# Course pages, quizzes, notebook

## A course page

One MDX file in `site/src/content/seiten/<name>.mdx`, published at `/kurs/<name>`. The text
is on the left, and the page's applet is on the right, large and sticky.

```mdx
---
titel: Wann kommt eine Folge zur Ruhe?
kurz: Die logistische Abbildung im Spinnwebdiagramm.
woche: 2
applet: logistic-cobweb           # the page's applet
zustand: { a: 2.8 }               # optional opening parameters
gesperrt: true                    # locked until a <Quiz schaltetFrei> is answered
voraussetzungen: [geometrische-folgen]
entwurf: false                    # true: a draft, only in `pnpm dev`, not published
---

## Die Frage

Plain Markdown: lists, tables, $y_{n+1} = a\,y_n(1 - y_n)$, display math with $$…$$.
```

Every `##` section becomes a card with a "Schritt n" badge (`site/rehype-abschnitte.mjs`);
use `###` for headings inside a section.

### Components

| Component | Shows |
|---|---|
| `<Aufgabe nr={2} titel="Die Schwelle" stern>…text… <Quiz id="…" /></Aufgabe>` | an exercise: introduction and its quizzes as one unit |
| `<Quiz id="…" />` | any quiz; `schaltetFrei` unlocks the page's applet once answered |
| `<Definition begriff="Fixpunkt">…</Definition>` | a definition |
| `<Behauptung>…</Behauptung>` | a claim to prove |
| `<Beweis>…</Beweis>` | a proof (open; can be folded) |
| `<Spaeter woche={5}>…</Spaeter>` | "proved later" |
| `<Bildluege>…</Bildluege>` | "where the picture lies": a limit of the picture |
| `<Tipp>…</Tipp>` | a folded hint |
| `<Applet id="…" zustand={{…}} />` | a further applet inside the text |

**Links that set the applet:** `[a = 3,2](#logistic-cobweb.a=3.2)` sets `a` and keeps the
rest; several values with `&`, each with the applet's id: `#sir.beta=0.3&sir.gamma=0.1`. A point is `x~y`.

## Quizzes on course pages

Questions live in `packages/quizzes/src/*.ts` as `defineQuiz({...})` and are placed with
`<Quiz id="…" />`. All types work here ([quizzes.md](quizzes.md#question-types)); those that
read the page's applet (`finde` with `applet`, `erzeuge`) only make sense next to it. Each
is checked when the student presses "Prüfen", with hints (`tipps`) and the solution after the
first attempt. The **id is permanent**: the notebook stores answers under it; bump `version`
when a question changes meaning.

Weekly quizzes on the lecture are a separate part of the site: [quizzes.md](quizzes.md#weekly-quizzes).

### Checkers (`@abacus/applet-core`)

| Checker | For |
|---|---|
| `schwelle({ ziel, toleranz, nah?, zuKlein?, zuGross? })` | a number against a known target, with a direction |
| `ablesen({ observable, toleranz })` | a value read off the applet in its current state |
| `klassifizieren({ observable, hinweise })` | one of a closed set, against a `klasse` readout |
| `bedingung((p, o) => boolean \| Diagnose)` | any condition on parameters and readouts |

A checker returns `{ status: 'richtig' | 'nah' | 'falsch', hinweis? }`. Hints should say
which way to go, not only "wrong". Compare readouts by their **value** (e.g.
`o.verhalten.value === 'oszillierend'`), not by the text they show.

## The notebook

Every answer, prediction and found value is kept in the browser (`localStorage`), per course
and semester (`site/src/config.ts`: `kurs.id`, `kurs.semester`; changing them orphans stored
answers). `/notizbuch` lists everything, with export and import as a file. Nothing is sent
anywhere. A server-backed store can implement the `NotebookStore` interface
(`packages/quiz/src/notebook.ts`), see [deployment.md](deployment.md).

## Which applets are listed

`packages/applets/applets.json` holds one entry per applet:

```json
{"id": "krebs", "sichtbar": false, "kapitel": "II", "folien": "19–25",
 "titel": "Krebserkrankung: drei Gruppen", "kurz": "Gesund, leicht und schwer erkrankt …"}
```

- `sichtbar: false` keeps an applet out of the overview. Its address `/applet/<id>` still
  works (for sharing), and search engines are asked to skip it.
- The order of the entries is the order within a chapter.
- `pnpm dev` shows every applet; unlisted ones carry a "nicht gelistet" badge.
- A missing or extra entry fails the tests with a message naming it.
