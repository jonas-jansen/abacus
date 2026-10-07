import { condition } from '@abacus/applet-core'
import { defineQuiz } from '@abacus/quiz/define'

export default [
  defineQuiz({
    id: 'ari-modell',
    type: 'single',
    question: 'Eine Kolonie gewinnt jedes Jahr $150$ Tiere dazu. Welche Folge beschreibt sie?',
    options: ['$x_{n+1} = x_n + 150$', '$x_{n+1} = 150\\,x_n$', '$x_{n+1} = 1.5\\,x_n$', '$x_n = 150^n$'],
    correct: 0,
    solution: 'Ein fester **Betrag** pro Schritt: Er wird addiert. Ein fester **Faktor** würde multipliziert (geometrische Folge).',
  }),
  defineQuiz({
    id: 'ari-x10',
    type: 'number',
    question: 'Es sei $x_0 = 20$ und $b = -3$. Berechnen Sie $x_{10}$.',
    quantity: '$x_{10}$',
    target: -10,
    tolerance: 0.001,
    hints: ['Jeder Schritt zieht $3$ ab. Wie oft?'],
    solution: '$x_{10} = x_0 + 10\\,b = 20 - 30 = -10$.',
  }),
  defineQuiz({
    id: 'ari-null',
    type: 'configure',
    applet: 'arithmetic',
    question: 'Stellen Sie $x_0 = 30$ ein und wählen Sie $b$ so, dass die Folge nach $N = 20$ Schritten genau bei $0$ ankommt.',
    checker: condition((p) => {
      const [x0, b, N] = [p.x0 as number, p.b as number, p.N as number]
      if (Math.abs(x0 - 30) > 0.5) return { status: 'wrong', hint: 'Zuerst $x_0 = 30$ einstellen.' }
      if (N !== 20) return { status: 'wrong', hint: 'Lassen Sie $N = 20$.' }
      const end = x0 + b * N
      if (Math.abs(end) <= 0.5) return { status: 'correct', hint: `Richtig: $b = ${(-x0 / N).toString()}$.` }
      return { status: Math.abs(end) <= 3 ? 'close' : 'wrong', hint: `Die Folge endet bei $x_{20} \\approx ${end.toFixed(1)}$.` }
    }),
    solution: '$x_{20} = 30 + 20\\,b = 0$, also $b = -1.5$.',
  }),
]
