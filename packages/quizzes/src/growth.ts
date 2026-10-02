import { condition, numText } from '@abacus/applet-core'
import { defineQuiz } from '@abacus/quiz/define'

export default [
  defineQuiz({
    id: 'wachstum-vorhersage',
    type: 'prediction',
    question: 'Bei welchem Wert von $x(t)$ ist die Kurve am steilsten?',
    options: ['ganz am Anfang, bei $x_0$', 'bei $K/2$', 'kurz bevor sie $K$ erreicht', 'das hängt von $r$ ab'],
  }),
  defineQuiz({
    id: 'wachstum-parabel',
    type: 'open',
    question: 'Wo hat $g(x) = r\\,x\\,(1 - x/K)$ sein Maximum, und wie groß ist es?',
    hints: ['$g$ ist eine nach unten geöffnete Parabel mit Nullstellen $0$ und $K$.'],
    solution: 'Der Scheitel liegt in der Mitte der Nullstellen, bei $x = K/2$, mit $g(K/2) = rK/4$.',
  }),
  defineQuiz({
    id: 'wachstum-wendepunkt',
    type: 'find',
    question: 'Für $r = 0{,}8$, $K = 50$, $x_0 = 2$: Zu welcher Zeit $t^*$ ist die Kurve am steilsten?',
    quantity: '$t^*$',
    target: 3.97,
    tolerance: 0.2,
    solution: '$t^* = \\frac{1}{r}\\ln\\frac{K - x_0}{x_0} = \\frac{\\ln 24}{0{,}8} \\approx 3{,}97$.',
  }),
  defineQuiz({
    id: 'wachstum-wendepunkt-5',
    type: 'configure',
    applet: 'log-ivp',
    question: 'Lassen Sie $K = 50$ und stellen Sie $r$ und $x_0$ so ein, dass die Kurve bei $t^* = 5$ am steilsten ist. Es gibt viele Lösungen.',
    checker: condition((p, o) => {
      const t = o.wendepunkt?.value
      if (Math.abs((p.K as number) - 50) > 0.5) return { status: 'wrong', hint: 'Lassen Sie $K = 50$.' }
      if (typeof t !== 'number') return { status: 'wrong', hint: 'Gerade gibt es keine steilste Stelle – woran liegt das?' }
      if (Math.abs(t - 5) <= 0.1) return { status: 'correct', hint: 'Finden Sie noch eine zweite Einstellung?' }
      return {
        status: Math.abs(t - 5) <= 0.5 ? 'close' : 'wrong',
        direction: t < 5 ? 'too small' : 'too large',
        hint: `Die steilste Stelle liegt jetzt bei $t^* \\approx ${numText(t, 3)}$.`,
      }
    }),
  }),
]
