# Quizzes

Quizzes are their own container (`packages/quiz` for the components, `packages/quizzes` for
the content). They never import an applet; a quiz that needs an applet's state reads it from
the channel. They appear in two places:

| Where | What for | Defined in |
|---|---|---|
| **Course pages** (`/kurs/…`) | single questions inside the text, to test understanding of the applet beside it | `packages/quizzes/src/*.ts`, placed with `<Quiz id="…" />` |
| **Quizze** (`/quiz`) | weekly quizzes on the lecture, taken as a whole and submitted | `packages/quizzes/src/wochen/*.ts` |

## Question types

Every question has `id`, `typ` and `frage`, and may have `tipps` (course pages), `loesung`
(shown with the result) and `version`. Text takes `$math$`, `$$…$$` and `**bold**`.

| `typ` | The student | Fields | Graded |
|---|---|---|---|
| `einfach` | picks one option | `optionen`, `richtig` (index), `mischen` | 1 or 0 |
| `mehrfach` | picks any number | `optionen`, `richtig` (indices), `mischen` | each right choice + 1/r, each wrong − 1/r, at least 0 (r = number of right options) |
| `zuordnung` | links each left item to its partner | `paare: [links, rechts][]`, `ablenker` | share of right pairs |
| `zahl` | types a number (German or English decimals) | `ziel`, `toleranz`, `groesse`, `einheit` | 1 within the tolerance; "nah" within 3×, with direction |
| `antwort` | writes an open answer | `musterloesung`, `kriterien` | not graded: shown with the model answer and criteria to compare |
| `vorhersage` | commits a prediction before looking | `optionen` (optional) | not graded |
| `finde` | finds a value in an applet | `groesse`, `ziel` or `pruefer`, `applet` | by the checker ([course.md](course.md#checkers-applet-core)) |
| `erzeuge` | sets the applet until a condition holds | `applet`, `pruefer` | by the checker; course pages only |

Options are shuffled per attempt (the same order after a reload); `mischen: false` keeps the
written order, e.g. for "keine davon" or ordered values. Answers are stored by the options'
indices in the definition, so shuffling never changes a grade. Grading is pure code in
`packages/quiz/src/bewertung.ts`; a server can run the same functions.

Definitions are checked when they load: an index outside the options, a matching with two
equal partners, a missing target, and similar mistakes fail with the question named.

```ts
defineQuiz({
  id: 'stabil',
  typ: 'mehrfach',
  frage: 'Für welche $a$ ist der Fixpunkt $y^* = 1 - 1/a$ anziehend?',
  optionen: ['$a = 0{,}5$', '$a = 1{,}5$', '$a = 2{,}8$', '$a = 3{,}2$'],
  richtig: [1, 2],
  mischen: false,
  loesung: "$f'(y^*) = 2 - a$, also anziehend genau für $1 < a < 3$.",
})
```

## Weekly quizzes

One file per quiz in `packages/quizzes/src/wochen/`, registered in `wochen/index.ts`. It is
published at `/quiz/<id>` and listed on `/quiz` and on the start page while it is open.

```ts
export default defineWochenquiz({
  id: 'woche-02',                 // permanent: attempts are stored under it
  titel: 'Fixpunkte der logistischen Abbildung',
  beschreibung: 'Fixpunkte von $f(y) = a\\,y\\,(1 - y)$ und ihre Stabilität.',
  woche: 2,
  ab: '2026-09-28T08:00',         // local time; open from the start if omitted
  bis: '2026-10-12T23:59',        // never closes if omitted
  versuche: 3,                    // unlimited if omitted
  loesungen: 'nachAbgabe',        // 'sofort' | 'nachAbgabe' | 'nachFrist'
  wertung: 'beste',               // or 'letzte': which attempt counts in the list
  fragen: [defineQuiz({ … }), …], // question ids only need to be unique within the quiz
})
```

| Rule | Effect |
|---|---|
| `ab`, `bis` | before: "öffnet am …"; after: no new attempts, past attempts stay visible |
| `versuche` | "Neuer Versuch" until used up; every attempt is kept |
| `loesungen: 'sofort'` | practice: each question has its own "Prüfen" while answering |
| `loesungen: 'nachAbgabe'` | score, marks and solutions right after submitting |
| `loesungen: 'nachFrist'` | after submitting only "abgegeben"; everything once `bis` has passed |
| `wertung` | the best (default) or the last attempt counts |
| `version` | bump when questions change meaning; earlier attempts belong to the old version |

Answers in progress are kept as a draft in the browser, so a reload loses nothing.
Submitting with open questions asks once ("Trotzdem abgeben?"); unanswered questions score 0.
Open answers (`antwort`) score no points; after submitting they are shown next to the model
answer and its criteria.

**What the rules are worth today:** they run in the browser. They guide students who play
fair, but cannot stop anyone who changes the computer's clock or clears the storage.
Anything that counts for admission needs the server below.

## Where answers are kept

Today every answer stays in the browser, in the notebook (`/notizbuch`). Each course
question has one entry with all its attempts. Each weekly quiz has one entry `wq-<id>` whose
attempts hold every answer, every grade and the score. Students can export and import the
notebook.

## Next: a server, statistics, retakes across devices

The components talk to the `NotebookStore` interface only (`packages/quiz/src/notebook.ts`).
A server store implements the same interface; no page changes. Planned shape:

- **Identity:** Shibboleth in front of the site (see [deployment.md](deployment.md)); the
  server reads the persistent id (`eppn` or a pairwise id) and never needs names.
- **API:** `POST /api/versuche` (one attempt: quiz, version, answers, grades, time),
  `GET /api/versuche?quiz=…` (the student's own), `GET /api/statistik?quiz=…` (admins only).
- **Grading on the server:** the same `bewerte()` from `bewertung.ts`, so a modified browser
  cannot fake a score; the server also enforces `ab`, `bis` and `versuche`.
- **Statistics for the lecturer, per quiz and question:** number of students and attempts,
  share right / partly / wrong, how often each wrong option was picked (which misconception),
  the matching pairs most often confused, the distribution of numeric answers, improvement
  from first to best attempt.
- **Privacy:** answers tied to a person are personal data. Before switching on: a privacy
  notice, the data protection officer's approval, a retention period (e.g. deleted after the
  semester), and pseudonymous ids in the statistics.

## Later: open answers with a local model

`kriterien` are written so they can serve as a grading rubric. A local language model (on a
university server, nothing leaves it) could compare an open answer with `musterloesung` and
the criteria. It should suggest which criteria are met, as feedback, not as a grade; the
lecturer stays in charge. It can run in batches overnight rather than live, which keeps the
computing needs small. Until then, open answers are shown next to the model answer so
students can judge their own.
