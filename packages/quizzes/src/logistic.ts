import { condition, threshold, numText } from '@abacus/applet-core'
import { defineQuiz } from '@abacus/quiz/define'

export default [
  defineQuiz({
    id: 'log-vorhersage-32',
    type: 'prediction',
    question: 'Bei $a = 2{,}8$ kommt die Folge zur Ruhe. Was erwarten Sie für $a = 3{,}2$?',
    options: ['Sie kommt auch zur Ruhe, nur langsamer.', 'Sie springt zwischen zwei Werten.', 'Sie wird völlig unregelmäßig.', 'Sie verlässt $[0, 1]$.'],
  }),
  defineQuiz({
    id: 'log-fixpunkte',
    type: 'open',
    question: 'Bestimmen Sie alle Fixpunkte von $f(y) = a\\,y(1-y)$ und den Wert $f\'(y^*)$ am zweiten Fixpunkt.',
    hints: ['Fixpunkt heißt $f(y^*) = y^*$.', '$f\'(y) = a(1 - 2y)$.'],
    solution: '$y^* = 0$ und $y^* = 1 - 1/a$. Dort ist $f\'(1 - 1/a) = a(1 - 2 + 2/a) = 2 - a$.',
  }),
  defineQuiz({
    id: 'log-schwelle',
    type: 'find',
    applet: 'logistic-cobweb',
    question: 'Ab welchem $a$ kommt die Folge **nicht mehr** auf einem einzigen Wert zur Ruhe?',
    quantity: '$a$',
    checking: 'later',
    checker: threshold({
      target: 3,
      tolerance: 0.02,
      tooSmall: (v) => `Bei $a = ${numText(v)}$ läuft die Folge noch auf einen Wert zu.`,
      tooLarge: (v) => `Bei $a = ${numText(v)}$ springt sie schon zwischen mehreren Werten.`,
    }),
    hints: ['Nutzen Sie die Lupe am Regler für $a$.'],
    solution: '$a = 3$. Dort ist $|f\'(y^*)| = |2 - a| = 1$ – der Beweis auf dieser Seite zeigt, warum genau hier.',
  }),
  defineQuiz({
    id: 'log-grenzwert-25',
    type: 'find',
    question: 'Lesen Sie für $a = 2{,}5$ den Grenzwert der Folge ab.',
    quantity: '$y^*$',
    target: 0.6,
    tolerance: 0.01,
  }),
  defineQuiz({
    id: 'log-periode-4',
    type: 'configure',
    applet: 'logistic-cobweb',
    question: 'Stellen Sie $a$ so ein, dass die Folge auf lange Sicht mit Periode 4 umläuft.',
    checker: condition((_p, o) => {
      const per = o.periode?.value
      if (per === 4) return { status: 'correct' }
      if (per === 2) return { status: 'close', direction: 'too small', hint: 'Periode 2 – noch etwas weiter.' }
      if (per === 1) return { status: 'wrong', direction: 'too small', hint: 'Die Folge kommt noch auf einem Punkt zur Ruhe.' }
      return { status: 'wrong', direction: 'too large', hint: per == null ? 'Kein Muster mehr zu erkennen.' : `Periode ${per}.` }
    }),
  }),
  defineQuiz({
    id: 'log-spirale-treppe',
    type: 'open',
    question:
      'Bei $a = 2{,}8$ nähert sich die Folge dem Fixpunkt abwechselnd von beiden Seiten, bei $a = 1{,}8$ von einer Seite. Woran sehen Sie das im Diagramm – und welche Rolle spielt das Vorzeichen von $f\'(y^*)$?',
    solution: '$f\'(y^*) = 2 - a$ ist bei $a = 2{,}8$ negativ (Spirale), bei $a = 1{,}8$ positiv (Treppe).',
  }),
]
