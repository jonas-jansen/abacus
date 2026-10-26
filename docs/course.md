# Course pages and the catalog

## A course page

One MDX file in `site/src/content/course/<name>.mdx`, published at `/<course>/kurs/<name>`. The text
is on the left; the page's applet is on the right, large and sticky.

```mdx
---
title: Wann kommt eine Folge zur Ruhe?
summary: Die logistische Abbildung im Spinnwebdiagramm.
week: 2
applet: logistic-cobweb           # the page's applet
state: { a: 2.8 }                 # optional opening parameters
locked: true                      # locked until a <Quiz unlocks> is answered
prerequisites: [geometrische-folgen]
draft: false                      # true: a draft, only in `pnpm dev`, not published
---

## Die Frage

Plain Markdown: lists, tables, $y_{n+1} = a\,y_n(1 - y_n)$, display math with $$…$$.
```

Every `##` section becomes a card with a "Schritt n" badge (`site/rehype-abschnitte.mjs`);
use `###` for headings inside a section. `order: 1, 2, …` sorts pages within a week.

## An applet's introduction

`site/src/content/intro/<applet-id>.md` – plain Markdown with `$math$`, written by hand:

```md
---
title: Worum es geht   # the small heading above it (optional)
---

Manche Größen ändern sich in jedem Schritt um **denselben Betrag** …
```

It appears below the applet on its own page (a reading card; the applet stays the centre), and
as the first section of every course page whose `applet` it is. Use `###` for headings in it.

### Components

| Component | Shows |
|---|---|
| `<Exercise number={2} title="Die Schwelle" star>…text… <Quiz id="…" /></Exercise>` | an exercise: introduction and its questions as one unit |
| `<Quiz id="…" number={3} />` | any question from `packages/quizzes`; `unlocks` unlocks the page's applet once answered |
| `<Definition term="Fixpunkt">…</Definition>` | a definition |
| `<Claim>…</Claim>` | a statement to prove |
| `<Proof>…</Proof>` | a proof (open; can be folded) |
| `<Later week={5}>…</Later>` | "proved later" |
| `<Caveat>…</Caveat>` | "where the picture lies": a limit of the picture |
| `<Hint>…</Hint>` | a folded hint |
| `<Applet id="…" state={{…}} />` | a further applet inside the text |

**Links that set the applet:** `[a = 3.2](#logistic-cobweb.a=3.2)` sets `a` and keeps the
rest; several values with `&`, each with the applet's id: `#sir.beta=0.3&sir.gamma=0.1`. A
point is `x~y`.

## Questions on course pages

Questions live in `packages/quizzes/src/*.ts` as `defineQuiz({...})` and are placed with
`<Quiz id="…" />`. All types work here ([quizzes.md](quizzes.md#question-types)); those
that read the page's applet (`find` with `applet`, `configure`) only make sense next to it.
Each is checked when the student presses "Prüfen", with `hints` and the solution after the
first attempt. The **id is permanent**: the notebook stores answers under it; bump
`version` when a question changes meaning.

Weekly quizzes on the lecture are a separate part of the site:
[quizzes.md](quizzes.md#weekly-quizzes).

### Checkers (`@abacus/applet-core`)

| Checker | For |
|---|---|
| `threshold({ target, tolerance, close?, tooSmall?, tooLarge? })` | a number against a known target, with a direction |
| `readOff({ observable, tolerance })` | a value read off the applet in its current state |
| `inCategory({ observable, hints })` | one of a closed set, against a `category` readout |
| `condition((p, o) => boolean or Diagnosis)` | any condition on parameters and readouts |

A checker returns `{ status: 'correct' | 'close' | 'wrong', hint?, direction? }`. Hints
should say which way to go, not only "wrong". Compare readouts by their **value** (e.g.
`o.verhalten.value === 'oscillating'`), not by the German text they show.

## The notebook

Every answer, prediction and quiz attempt is kept in the browser (`localStorage`), per course
and semester (`site/src/courses.ts`: `id`, `semester`; changing them orphans stored answers).
`/<course>/notizbuch` lists the course's entries, with export and import as a file. Nothing is sent
anywhere. A server-backed store can implement the `NotebookStore` interface
(`packages/quiz/src/notebook.ts`), see [quizzes.md](quizzes.md#next-a-server-statistics-retakes-across-devices).

## Exercise sheets

One page per sheet for the exercise class: `/<course>/uebung/<id>`, a tab per part (← → switch,
each part has its own address, e.g. `…/uebung/1#1.4`), each with its equation box and a
scenario applet sized so that one part fits on the projector.

1. The applets: `packages/applets/src/exercises/blatt<id>.ts`, one `defineApplet` per part with
   `scenariosOnly: true`, `stepwise: true`, `formulas` (the exercise's equations, fixed numbers
   as plain TeX) and scenarios for what the part asks ("n = 0 … 4") or a look further. They
   are registered in `exerciseApplets` (`packages/applets/src/index.ts`), never in the gallery.
2. The sheet: an entry in `site/src/exercises.ts` with its parts (tab, title, applet).
3. Which build shows it: the beta always; a release profile only with `"exercises": ["1"]`
   in `site/releases.json`.

The sheets themselves (PDF) are not published by the site.

## Which applets are listed

`packages/applets/applets.json` holds one entry per applet:

```json
{"id": "krebs", "visible": false, "chapter": "II", "slides": "19–25",
 "title": "Krebserkrankung: drei Gruppen", "summary": "Gesund, leicht und schwer erkrankt …"}
```

- `visible: false` keeps an applet out of the overview. Its address `/<course>/applet/<id>` still
  works (for sharing), and search engines are asked to skip it.
- `chapter` is `0` (shown as "Einführung"), `I`, `II`, `III`, `IV` or `Appendix` (shown as
  "Anhang").
- The order of the entries is the order within a chapter.
- `pnpm dev` shows every applet; unlisted ones carry a "nicht gelistet" badge.
- A missing or extra entry fails the tests with a message naming it.
