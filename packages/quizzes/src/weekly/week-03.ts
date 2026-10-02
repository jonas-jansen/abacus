import { defineQuiz, defineWeeklyQuiz } from '@abacus/quiz/define'

/** One attempt; results and solutions only after the deadline. */
export default defineWeeklyQuiz({
  id: 'woche-03',
  title: 'Exponentielles und logistisches Wachstum',
  description: 'Differentialgleichungen erster Ordnung: Lösungen, Verdopplungszeit, Sättigung.',
  week: 3,
  opens: '2026-10-12T08:00',
  closes: '2026-10-26T23:59',
  attempts: 1,
  solutions: 'after-close',
  questions: [
    defineQuiz({
      id: 'verdopplung',
      type: 'number',
      question: "Es sei $N' = 0{,}2\\,N$ mit $N(0) = 100$. Nach welcher Zeit hat sich $N$ verdoppelt? (auf zwei Nachkommastellen)",
      quantity: '$t$',
      target: Math.log(2) / 0.2,
      tolerance: 0.01,
      solution: '$e^{0{,}2\\,t} = 2 \\iff t = \\ln 2 / 0{,}2 \\approx 3{,}47$.',
    }),
    defineQuiz({
      id: 'logistisch',
      type: 'single',
      question: "Die Lösung von $N' = r\\,N\\,(1 - N/K)$ mit $r > 0$ und $0 < N(0) < K$ …",
      options: ['wächst monoton gegen $K$', 'wächst über alle Grenzen', 'schwingt um $K$', 'fällt gegen $0$'],
      correct: 0,
    }),
    defineQuiz({
      id: 'loesungen',
      type: 'match',
      question: 'Ordnen Sie jeder Gleichung ihre allgemeine Lösung zu.',
      pairs: [
        ["$y' = 2\\,y$", '$y = C\\,e^{2t}$'],
        ["$y' = -y$", '$y = C\\,e^{-t}$'],
        ["$y' = 2$", '$y = 2t + C$'],
      ],
      distractors: ['$y = C\\,t^2$'],
    }),
    defineQuiz({
      id: 'schnellstes',
      type: 'open',
      question: 'Bei welcher Größe $N$ wächst die logistische Lösung am schnellsten, und warum?',
      modelAnswer: "Bei $N = K/2$. Die Wachstumsrate $N' = r\\,N\\,(1 - N/K)$ ist als Funktion von $N$ eine nach unten geöffnete Parabel mit den Nullstellen $0$ und $K$; ihr Maximum liegt in der Mitte.",
      criteria: ['$N = K/2$', "$N'$ als Parabel in $N$", 'Maximum zwischen den Nullstellen $0$ und $K$'],
    }),
  ],
})
