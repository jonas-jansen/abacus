import { defineQuiz, defineWeeklyQuiz } from '@abacus/quiz/define'

/**
 * The first quiz of the term: material of the preparatory course (sheets 1–9) that the lecture
 * builds on – percentages, logarithms, equations, inequalities, derivatives, systems. On
 * purpose without terms of the lecture itself (sequences, fixed points, stability, Newton).
 * Source: uploads/Quiz_Vorkurs.md.
 */
export default defineWeeklyQuiz({
  id: 'vorkurs',
  title: 'Wiederholung Vorkurs',
  description: 'Prozente, Logarithmen, Gleichungen, Ungleichungen, Ableitungen und Gleichungssysteme aus dem Vorkurs.',
  week: 0,
  // this term's default: open from the start of term, no closing date, as many attempts as wanted
  opens: '2026-10-07T08:00',
  solutions: 'after-submit',
  questions: [
    // Vorkurs Blatt 1, A6
    defineQuiz({
      id: 'prozent',
      type: 'number',
      question: String.raw`Eine Population wächst drei Jahre lang um je $10\,\%$ und schrumpft im vierten Jahr um $30\,\%$. Um wie viel Prozent hat sie sich insgesamt verändert? Geben Sie eine Abnahme mit negativem Vorzeichen an, in Prozent.`,
      quantity: 'Änderung',
      unit: '%',
      target: -6.83,
      tolerance: 0.01,
      solution: String.raw`Der Gesamtfaktor ist $1.1^3 \cdot 0.7 = 0.9317$, also eine Abnahme um $6.83\,\%$. Prozentuale Änderungen werden multipliziert, nicht addiert: $3 \cdot 10\,\% - 30\,\% = 0$ ist falsch.`,
    }),
    // Vorkurs Blatt 3, A10–11; Blatt 4, A11
    defineQuiz({
      id: 'wachstum',
      type: 'number',
      question: String.raw`Eine Bakterienkultur wächst nach $N(t) = 50 \cdot 1.2^t$ ($t$ in Stunden). Nach welcher Zeit sind es $1000$ Bakterien? (Auf zwei Nachkommastellen.)`,
      quantity: '$t$',
      target: 16.43,
      tolerance: 0.01,
      solution: String.raw`$1.2^t = 20 \iff t = \dfrac{\ln 20}{\ln 1.2} \approx 16.43$ Stunden.`,
    }),
    // Vorkurs Blatt 3, A5
    defineQuiz({
      id: 'bruchgleichung',
      type: 'single',
      question: String.raw`Welche Menge ist die Lösungsmenge der Gleichung $x = \dfrac{4x}{1+x}$?`,
      options: [String.raw`$\{0,\ 3\}$`, String.raw`$\{3\}$`, String.raw`$\{0,\ 4\}$`, String.raw`$\{-1,\ 3\}$`],
      correct: 0,
      solution: String.raw`Für $x \neq -1$ gilt: $x(1+x) = 4x \iff x^2 - 3x = 0 \iff x\,(x-3) = 0$. Wer durch $x$ teilt, verliert die Lösung $x = 0$; $x = -1$ liegt nicht im Definitionsbereich.`,
    }),
    // Vorkurs Blatt 3, A12
    defineQuiz({
      id: 'betrag',
      type: 'multiple',
      question: String.raw`Für welche der folgenden Werte von $a$ gilt $|2 - a| < 1$?`,
      options: ['$a = 0.5$', '$a = 1.5$', '$a = 2.5$', '$a = 3$', '$a = 3.5$'],
      correct: [1, 2],
      shuffle: false,
      solution: String.raw`$|2 - a| < 1 \iff -1 < 2 - a < 1 \iff 1 < a < 3$. Der Randwert $a = 3$ gehört wegen des strikten $<$ nicht dazu.`,
    }),
    // Vorkurs Blatt 6, A5–6
    defineQuiz({
      id: 'tangente',
      type: 'number',
      question: String.raw`Die Tangente an den Graphen von $g(x) = x^2 - 2$ im Punkt $x_0 = 1$ schneidet die $x$-Achse bei $x_1$. Berechnen Sie $x_1$.`,
      quantity: '$x_1$',
      target: 1.5,
      tolerance: 0.001,
      solution: String.raw`$g(1) = -1$ und $g'(1) = 2$. Die Tangente $y = -1 + 2\,(x - 1)$ hat die Nullstelle $x_1 = 1.5$. Sie liegt schon nahe an der Nullstelle $\sqrt 2 \approx 1.414$ von $g$.`,
    }),
    // Vorkurs Blatt 6, A1 und A4
    defineQuiz({
      id: 'ableitungen',
      type: 'match',
      question: 'Ordnen Sie jeder Funktion ihre Ableitung zu.',
      pairs: [
        [String.raw`$e^{-2x}$`, String.raw`$-2\,e^{-2x}$`],
        [String.raw`$x\,e^{-x}$`, String.raw`$(1 - x)\,e^{-x}$`],
        [String.raw`$\ln(1 + x^2)$`, String.raw`$\dfrac{2x}{1 + x^2}$`],
        [String.raw`$\dfrac{x}{1 + x}$`, String.raw`$\dfrac{1}{(1 + x)^2}$`],
      ],
      distractors: [String.raw`$-x\,e^{-x}$`],
      solution: String.raw`Kettenregel bei $e^{-2x}$ und $\ln(1+x^2)$, Produktregel bei $x\,e^{-x}$, Quotientenregel bei $\frac{x}{1+x}$: $\frac{(1+x) - x}{(1+x)^2}$.`,
    }),
    // Vorkurs Blatt 9, A6
    defineQuiz({
      id: 'gleichungssystem',
      type: 'multiple',
      question: String.raw`Welche Punkte $(x, y)$ lösen das Gleichungssystem $x\,(2 - y) = 0$, $\; y\,(x - 1) = 0$?`,
      options: [String.raw`$(0,\ 0)$`, String.raw`$(1,\ 2)$`, String.raw`$(2,\ 1)$`, String.raw`$(0,\ 2)$`, String.raw`$(1,\ 0)$`],
      correct: [0, 1],
      solution: String.raw`Aus der ersten Gleichung folgt $x = 0$ oder $y = 2$. Für $x = 0$ liefert die zweite $-y = 0$, also $y = 0$. Für $y = 2$ liefert sie $2\,(x - 1) = 0$, also $x = 1$. Bei $(0, 2)$ und $(1, 0)$ ist jeweils nur eine der beiden Gleichungen erfüllt.`,
    }),
    // Vorkurs Blatt 2, A6–7; Blatt 4, A3
    defineQuiz({
      id: 'log-gerade',
      type: 'open',
      question: String.raw`Es sei $f(t) = c \cdot a^t$ mit $c, a > 0$. Begründen Sie, warum der Graph von $g(t) = \ln\bigl(f(t)\bigr)$ eine Gerade ist. Welche Steigung und welchen $y$-Achsenabschnitt hat sie?`,
      modelAnswer: String.raw`Nach den Logarithmengesetzen gilt $g(t) = \ln(c\,a^t) = \ln c + \ln(a^t) = \ln c + t \ln a$. Das ist eine lineare Funktion von $t$ mit der Steigung $\ln a$ und dem $y$-Achsenabschnitt $\ln c$.`,
      criteria: [String.raw`Produktregel: $\ln(c\,a^t) = \ln c + \ln(a^t)$`, String.raw`Potenzregel: $\ln(a^t) = t \ln a$`, String.raw`Steigung $\ln a$, Achsenabschnitt $\ln c$`],
    }),
  ],
})
