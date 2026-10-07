import { defineQuiz, defineWeeklyQuiz } from '@abacus/quiz/define'

/** Two weeks open, three attempts, the best counts; solutions right after submitting. */
export default defineWeeklyQuiz({
  id: 'woche-02',
  title: 'Fixpunkte der logistischen Abbildung',
  description: 'Fixpunkte von $f(y) = a\\,y\\,(1 - y)$, ihre Stabilität und das Verhalten der Folge.',
  week: 2,
  opens: '2026-09-28T08:00',
  closes: '2026-10-12T23:59',
  attempts: 3,
  solutions: 'after-submit',
  questions: [
    defineQuiz({
      id: 'fixpunkt',
      type: 'number',
      question: 'Berechnen Sie den von $0$ verschiedenen Fixpunkt von $f(y) = a\\,y\\,(1-y)$ für $a = 2.5$.',
      quantity: '$y^*$',
      target: 0.6,
      tolerance: 0.001,
      solution: '$a\\,y(1-y) = y$ mit $y \\neq 0$ gibt $1 - y = 1/a$, also $y^* = 1 - 1/a = 0.6$.',
    }),
    defineQuiz({
      id: 'anziehend',
      type: 'single',
      question: 'Ein Fixpunkt $y^*$ einer differenzierbaren Abbildung $f$ ist anziehend, wenn …',
      options: ["$|f'(y^*)| < 1$", "$f'(y^*) > 0$", '$f(y^*) = 0$', "$|f'(y^*)| > 1$"],
      correct: 0,
    }),
    defineQuiz({
      id: 'ableitung',
      type: 'number',
      question: "Berechnen Sie $f'(y^*)$ für $a = 2.5$ am Fixpunkt $y^* = 0.6$.",
      quantity: "$f'(y^*)$",
      target: -0.5,
      tolerance: 0.001,
      solution: "$f'(y) = a\\,(1 - 2y)$, also $f'(0.6) = 2.5 \\cdot (1 - 1.2) = -0.5$.",
    }),
    defineQuiz({
      id: 'stabil',
      type: 'multiple',
      question: 'Für welche $a$ ist der Fixpunkt $y^* = 1 - 1/a$ anziehend?',
      options: ['$a = 0.5$', '$a = 1.5$', '$a = 2.8$', '$a = 3.2$', '$a = 3.9$'],
      correct: [1, 2],
      shuffle: false,
      solution: "$f'(y^*) = 2 - a$, also anziehend genau für $|2 - a| < 1$, d. h. $1 < a < 3$.",
    }),
    defineQuiz({
      id: 'langfristig',
      type: 'match',
      question: 'Ordnen Sie jedem $a$ das langfristige Verhalten der Folge zu (Start $y_0 = 0.2$).',
      pairs: [
        ['$a = 0.8$', 'stirbt aus: $y_n \\to 0$'],
        ['$a = 2.8$', 'kommt zur Ruhe auf $1 - 1/a$'],
        ['$a = 3.2$', 'pendelt zwischen zwei Werten'],
        ['$a = 3.9$', 'kein erkennbares Muster'],
      ],
      distractors: ['wächst über alle Grenzen'],
    }),
    defineQuiz({
      id: 'spinnweb',
      type: 'single',
      question: 'Welches Spinnwebdiagramm gehört zu $a = 3.2$ (Start $y_0 = 0.1$)?',
      options: [
        { applet: 'logistic-cobweb', state: { a: 2.8 }, alt: 'Spinnweb für a = 2.8' },
        { applet: 'logistic-cobweb', state: { a: 3.2 }, alt: 'Spinnweb für a = 3.2' },
        { applet: 'logistic-cobweb', state: { a: 3.9 }, alt: 'Spinnweb für a = 3.9' },
        { applet: 'logistic-cobweb', state: { a: 0.8 }, alt: 'Spinnweb für a = 0.8' },
      ],
      correct: 1,
      solution: 'Für $a = 3.2$ läuft die Folge auf einen Zweierzyklus: das Spinnweb endet in einem Rechteck um den Fixpunkt.',
    }),
    defineQuiz({
      id: 'zeitverlauf',
      type: 'match',
      question: 'Ziehen Sie jeden Zeitverlauf $y_n$ zu seinem $a$.',
      pairs: [
        ['$a = 0.8$', { applet: 'logistic-cobweb', state: { a: 0.8 }, plot: 1, alt: 'Zeitverlauf für a = 0.8' }],
        ['$a = 2.8$', { applet: 'logistic-cobweb', state: { a: 2.8 }, plot: 1, alt: 'Zeitverlauf für a = 2.8' }],
        ['$a = 3.2$', { applet: 'logistic-cobweb', state: { a: 3.2 }, plot: 1, alt: 'Zeitverlauf für a = 3.2' }],
      ],
      distractors: [{ applet: 'logistic-cobweb', state: { a: 3.9 }, plot: 1, alt: 'Zeitverlauf für a = 3.9' }],
    }),
    defineQuiz({
      id: 'seiten',
      type: 'open',
      question: 'Warum nähert sich die Folge für $a = 2.8$ dem Fixpunkt abwechselnd von beiden Seiten, für $a = 1.8$ aber von einer Seite?',
      modelAnswer:
        "Nahe am Fixpunkt gilt für den Abstand $e_n = y_n - y^*$ ungefähr $e_{n+1} \\approx f'(y^*)\\,e_n$ mit $f'(y^*) = 2 - a$. Für $a = 1.8$ ist $f'(y^*) = 0.2 > 0$: der Abstand behält sein Vorzeichen. Für $a = 2.8$ ist $f'(y^*) = -0.8 < 0$: das Vorzeichen wechselt in jedem Schritt.",
      criteria: ["Linearisierung $e_{n+1} \\approx f'(y^*)\\,e_n$", "$f'(y^*) = 2 - a$", 'negatives Vorzeichen: Seitenwechsel; positives: von einer Seite'],
    }),
  ],
})
