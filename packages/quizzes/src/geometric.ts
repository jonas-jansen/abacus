import { condition, threshold, numText } from '@abacus/applet-core'
import { defineQuiz } from '@abacus/quiz/define'

export default [
  defineQuiz({
    id: 'geo-vorhersage-negativ',
    type: 'prediction',
    question: 'Was macht die Folge für $a = -0.9$ und $x_0 = 5$?',
    options: ['Sie wächst über alle Grenzen.', 'Sie springt hin und her und wird kleiner.', 'Sie springt hin und her und wird größer.', 'Sie bleibt konstant.'],
  }),
  defineQuiz({
    id: 'geo-formel',
    type: 'open',
    question: 'Geben Sie eine Formel für $x_n$ an, in der nur $a$, $x_0$ und $n$ vorkommen.',
    hints: ['Schreiben Sie $x_1, x_2, x_3$ mit $x_0$ aus.'],
    solution: '$x_n = a^n x_0$, per Induktion: $x_{n+1} = a\\,x_n = a \\cdot a^n x_0 = a^{n+1} x_0$.',
  }),
  defineQuiz({
    id: 'geo-konstant',
    type: 'find',
    applet: 'geometric',
    question: 'Für welches $a$ bleibt die Folge bei $x_0 \\neq 0$ konstant?',
    quantity: '$a$',
    tolerance: 0.005,
    checker: threshold({
      target: 1,
      tolerance: 0.005,
      tooSmall: (v) => (v > 0 ? `Bei $a = ${numText(v)}$ schrumpft die Folge noch.` : 'Bei negativem $a$ springt das Vorzeichen.'),
      tooLarge: (v) => `Bei $a = ${numText(v)}$ wächst die Folge.`,
    }),
    solution: '$a = 1$: dann ist $x_{n+1} = x_n$ für alle $n$. Für jedes andere $a$ ändert sich $x_n = a^n x_0$ mit $n$.',
  }),
  defineQuiz({
    id: 'geo-oszilliert',
    type: 'configure',
    applet: 'geometric',
    question: 'Stellen Sie $a$ so ein, dass die Folge bei jedem Schritt das Vorzeichen wechselt **und** dabei schrumpft.',
    checker: condition((p, o) =>
      o.verhalten?.value === 'oscillating' && Math.abs(p.a as number) < 1
        ? { status: 'correct' }
        : o.verhalten?.value !== 'oscillating'
          ? { status: 'wrong', hint: 'Die Folge wechselt noch nicht das Vorzeichen. Welches $a$ bewirkt das?' }
          : { status: 'close', hint: 'Sie springt – aber schrumpft sie auch?' },
    ),
  }),
  defineQuiz({
    id: 'geo-unter-001',
    type: 'find',
    question: 'Es sei $a = 0.5$ und $x_0 = 5$. Ab welchem $n$ ist $x_n < 0.01$? Erst rechnen, dann nachsehen.',
    quantity: '$n$',
    target: 9,
    hints: ['Lösen Sie $5 \\cdot 0.5^n < 0.01$ mit dem Logarithmus.'],
    solution: '$0.5^n < 0.002 \\iff n > \\log 0.002 / \\log 0.5 \\approx 8.97$, also ab $n = 9$.',
  }),
]
