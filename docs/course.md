# Course pages and the catalog

## A course page

One MDX file in `site/src/content/course/<name>.mdx`, published at `/kurs/<name>`. The text
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
use `###` for headings inside a section.

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

**Links that set the applet:** `[a = 3,2](#logistic-cobweb.a=3.2)` sets `a` and keeps the
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
and semester (`site/src/config.ts`: `kurs.id`, `kurs.semester`; changing them orphans stored
answers). `/notizbuch` lists everything, with export and import as a file. Nothing is sent
anywhere. A server-backed store can implement the `NotebookStore` interface
(`packages/quiz/src/notebook.ts`), see [quizzes.md](quizzes.md#next-a-server-statistics-retakes-across-devices).

## Which applets are listed

`packages/applets/applets.json` holds one entry per applet:

```json
{"id": "krebs", "visible": false, "chapter": "II", "slides": "19–25",
 "title": "Krebserkrankung: drei Gruppen", "summary": "Gesund, leicht und schwer erkrankt …"}
```

- `visible: false` keeps an applet out of the overview. Its address `/applet/<id>` still
  works (for sharing), and search engines are asked to skip it.
- `chapter` is `I`, `II`, `III`, `IV` or `Appendix` (shown as "Anhang").
- The order of the entries is the order within a chapter.
- `pnpm dev` shows every applet; unlisted ones carry a "nicht gelistet" badge.
- A missing or extra entry fails the tests with a message naming it.
