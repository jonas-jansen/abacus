# Quizzes

Quizzes are their own container (`packages/quiz` for the components, `packages/quizzes` for
the content). They never import an applet; a question that needs an applet's state reads it
from the channel, and plot pictures are drawn by the site. They appear in two places:

| Where | What for | Defined in |
|---|---|---|
| **Course pages** (`/kurs/…`) | single questions inside the text, to test understanding of the applet beside it | `packages/quizzes/src/*.ts`, placed with `<Quiz id="…" />` |
| **Quizze** (`/quiz`) | weekly quizzes on the lecture, taken as a whole and submitted | `packages/quizzes/src/weekly/*.ts` |

## Question types

Every question has `id`, `type` and `question`, and may have `image`, `hints` (course
pages), `solution` (shown with the result) and `version`. Text takes `$math$`, `$$…$$` and
`**bold**`.

| `type` | The student | Fields | Graded |
|---|---|---|---|
| `single` | picks one option | `options`, `correct` (index), `shuffle` | 1 or 0 |
| `multiple` | picks any number | `options`, `correct` (indices), `shuffle` | each right choice + 1/r, each wrong − 1/r, at least 0 (r = number of right options) |
| `match` | drags each answer onto its partner | `pairs: [left, right][]`, `distractors` | share of right pairs |
| `number` | types a number (German or English decimals) | `target`, `tolerance`, `quantity`, `unit` | 1 within the tolerance; "close" within 3×, with direction |
| `open` | writes an answer | `modelAnswer`, `criteria` | not graded: shown with the model answer and criteria to compare |
| `prediction` | commits a prediction before looking | `options` (optional) | not graded |
| `find` | finds a value in an applet | `quantity`, `target` or `checker`, `applet` | by the checker ([course.md](course.md#checkers-abacusapplet-core)) |
| `configure` | sets the applet until a condition holds | `applet`, `checker` | by the checker; course pages only |

Options are shuffled per attempt (the same order after a reload); `shuffle: false` keeps the
written order, e.g. for "keine davon" or ordered values. Answers are stored by the options'
indices in the definition, so shuffling never changes a grade. Grading is pure code in
`packages/quiz/src/grading.ts`; a server can run the same functions.

**Matching** is done by dragging: answer cards lie in a pile under the left items and are
dragged onto the slot beside their partner, with the mouse or a finger; a card dropped on a
filled slot swaps places, and the page scrolls when a card nears the edge. Without dragging,
a click on a card and then on a slot does the same (keyboard: Enter).

Definitions are checked when they load: an index outside the options, a matching with two
equal partners, a missing target and similar mistakes fail with the question named.

```ts
defineQuiz({
  id: 'stabil',
  type: 'multiple',
  question: 'Für welche $a$ ist der Fixpunkt $y^* = 1 - 1/a$ anziehend?',
  options: ['$a = 0{,}5$', '$a = 1{,}5$', '$a = 2{,}8$', '$a = 3{,}2$'],
  correct: [1, 2],
  shuffle: false,
  solution: "$f'(y^*) = 2 - a$, also anziehend genau für $1 < a < 3$.",
})
```

### Pictures

Options, matching items and the question itself (`image`) can be pictures instead of text:

```ts
// a plot of an applet in a given state, drawn by the plot library exactly like in the applet
{ applet: 'logistic-cobweb', state: { a: 3.2 }, plot: 1, alt: 'Zeitverlauf für a = 3,2' }
// an image file under site/public/ (SVG, PNG, JPG)
{ src: 'bilder/zelle.svg', alt: 'Eine Zelle' }
```

`plot` picks which of the applet's plots (default: the first), `state` the parameters that
differ from its defaults. `alt` describes the picture for screen readers and for the
notebook. Example, "which plot belongs to this parameter":

```ts
defineQuiz({
  id: 'zeitverlauf',
  type: 'match',
  question: 'Ziehen Sie jeden Zeitverlauf $y_n$ zu seinem $a$.',
  pairs: [
    ['$a = 0{,}8$', { applet: 'logistic-cobweb', state: { a: 0.8 }, plot: 1, alt: 'a = 0,8' }],
    ['$a = 2{,}8$', { applet: 'logistic-cobweb', state: { a: 2.8 }, plot: 1, alt: 'a = 2,8' }],
    ['$a = 3{,}2$', { applet: 'logistic-cobweb', state: { a: 3.2 }, plot: 1, alt: 'a = 3,2' }],
  ],
  distractors: [{ applet: 'logistic-cobweb', state: { a: 3.9 }, plot: 1, alt: 'a = 3,9' }],
})
```

The quiz package only knows the description; `site/src/islands.tsx` hands it a renderer
(`QuizImages`) that looks up the applet and draws the plot (`site/src/preview.ts`).

## Weekly quizzes

One file per quiz in `packages/quizzes/src/weekly/`, registered in `weekly/index.ts`, and one
line in the catalog `packages/quizzes/quizzes.json`:

```json
{ "id": "vorkurs", "visible": true }
```

`visible: false` takes a quiz out of the list on `/quiz` and the start page; its address
`/quiz/<id>` keeps working (to share; search engines are asked to skip it). `pnpm dev` lists
all, hidden ones marked. A quiz missing in the catalog, or an entry without a quiz, fails the
tests with a message naming it. The list is ordered by `week`.

**New quizzes from Markdown:** drafts handed over as Markdown go into `uploads/` (not in the
repository); they are turned into a file here. The tests check, for every quiz, that its own
answer key grades as correct, and that number questions accept their tolerance.

```ts
export default defineWeeklyQuiz({
  id: 'woche-02',                 // permanent: attempts are stored under it; also the URL
  title: 'Fixpunkte der logistischen Abbildung',
  description: 'Fixpunkte von $f(y) = a\\,y\\,(1 - y)$ und ihre Stabilität.',
  week: 2,
  opens: '2026-09-28T08:00',      // local time; open from the start if omitted
  closes: '2026-10-12T23:59',     // never closes if omitted
  attempts: 3,                    // unlimited if omitted
  solutions: 'after-submit',      // 'while-answering' | 'after-submit' | 'after-close'
  counts: 'best',                 // or 'last': which attempt counts in the list
  questions: [defineQuiz({ … }), …], // question ids only need to be unique within the quiz
})
```

| Rule | Effect |
|---|---|
| `opens`, `closes` | before: "öffnet am …"; after: no new attempts, past attempts stay visible |
| `attempts` | "Neuer Versuch" until used up; every attempt is kept |
| `solutions: 'while-answering'` | practice: each question has its own "Prüfen" while answering |
| `solutions: 'after-submit'` | score, marks and solutions right after submitting |
| `solutions: 'after-close'` | after submitting only "abgegeben"; everything once `closes` has passed |
| `counts` | the best (default) or the last attempt counts |
| `version` | bump when questions change meaning; earlier attempts belong to the old version |

Answers in progress are kept as a draft in the browser, so a reload loses nothing.
Submitting with open questions asks once ("Trotzdem abgeben?"); unanswered questions score 0.
Open answers score no points; after submitting they are shown next to the model answer and
its criteria.

**What the rules are worth today:** they run in the browser. They guide students who play
fair, but cannot stop anyone who changes the computer's clock or clears the storage.
Anything that counts for admission needs the server below.

## How results look

Each graded answer gets a badge: "Richtig" with a check in a green circle (it draws itself),
amber for partly right, a cross in red for wrong. The words depend on whether a retry follows:
on course pages and while practising, "Fast" and "Noch nicht" invite the next attempt; in the
result of a submitted quiz the verdict is final: "Teilweise · 0,5 Punkte" and "Falsch".
Picture options are laid out two by two; in matching, the pile of pictures is two by two, and a
slot holding a plot hugs it. In the result of a weekly
quiz, right options are green with a check, a wrong choice red with a cross, a right option
that was missed has a dashed green border; matching rows are green or red, with the right
partner named. A ring shows the share of points.

## Where answers are kept

Today every answer stays in the browser, in the notebook (`/notizbuch`). Each course question
has one entry with all its attempts. Each weekly quiz has one entry `wq-<id>` whose attempts
hold every answer, every grade and the score. Students can export and import the notebook.
Notebooks and exports from before the switch to English names are converted when read.

## Next: a server, statistics, retakes across devices

The components talk to the `NotebookStore` interface only (`packages/quiz/src/notebook.ts`).
A server store implements the same interface; no page changes. Planned shape:

- **Identity:** Shibboleth in front of the site (see [deployment.md](deployment.md)); the
  server reads the persistent id (`eppn` or a pairwise id) and never needs names.
- **API:** `POST /api/attempts` (one attempt: quiz, version, answers, grades, time),
  `GET /api/attempts?quiz=…` (the student's own), `GET /api/stats?quiz=…` (admins only).
- **Grading on the server:** the same `grade()` from `grading.ts`, so a modified browser
  cannot fake a score; the server also enforces `opens`, `closes` and `attempts`.
- **Statistics for the lecturer, per quiz and question:** number of students and attempts,
  share right / partly / wrong, how often each wrong option was picked (which misconception),
  the matching pairs most often confused, the distribution of numeric answers, improvement
  from first to best attempt.
- **Privacy:** answers tied to a person are personal data. Before switching on: a privacy
  notice, the data protection officer's approval, a retention period (e.g. deleted after the
  semester), and pseudonymous ids in the statistics.

## Later: open answers with a local model

`criteria` are written so they can serve as a grading rubric. A local language model (on a
university server, nothing leaves it) could compare an open answer with `modelAnswer` and
the criteria and suggest which criteria are met – as feedback, not as a grade; the lecturer
stays in charge. Run in batches overnight rather than live, it needs little computing time.
Until then, open answers are shown next to the model answer so students can judge their own.
