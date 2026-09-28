import { bedingung, schwelle, zahlText } from '@abacus/applet-core'
import { defineQuiz } from '@abacus/quiz/define'

export default [
  defineQuiz({
    id: 'log-vorhersage-32',
    typ: 'vorhersage',
    frage: 'Bei $a = 2{,}8$ kommt die Folge zur Ruhe. Was erwarten Sie für $a = 3{,}2$?',
    optionen: ['Sie kommt auch zur Ruhe, nur langsamer.', 'Sie springt zwischen zwei Werten.', 'Sie wird völlig unregelmäßig.', 'Sie verlässt $[0, 1]$.'],
  }),
  defineQuiz({
    id: 'log-fixpunkte',
    typ: 'antwort',
    frage: 'Bestimmen Sie alle Fixpunkte von $f(y) = a\\,y(1-y)$ und den Wert $f\'(y^*)$ am zweiten Fixpunkt.',
    tipps: ['Fixpunkt heißt $f(y^*) = y^*$.', '$f\'(y) = a(1 - 2y)$.'],
    loesung: '$y^* = 0$ und $y^* = 1 - 1/a$. Dort ist $f\'(1 - 1/a) = a(1 - 2 + 2/a) = 2 - a$.',
  }),
  defineQuiz({
    id: 'log-schwelle',
    typ: 'finde',
    applet: 'logistic-cobweb',
    frage: 'Ab welchem $a$ kommt die Folge **nicht mehr** auf einem einzigen Wert zur Ruhe?',
    groesse: '$a$',
    pruefung: 'spaeter',
    pruefer: schwelle({
      ziel: 3,
      toleranz: 0.02,
      zuKlein: (v) => `Bei $a = ${zahlText(v)}$ läuft die Folge noch auf einen Wert zu.`,
      zuGross: (v) => `Bei $a = ${zahlText(v)}$ springt sie schon zwischen mehreren Werten.`,
    }),
    tipps: ['Nutzen Sie die Lupe am Regler für $a$.'],
    loesung: '$a = 3$. Dort ist $|f\'(y^*)| = |2 - a| = 1$ – der Beweis auf dieser Seite zeigt, warum genau hier.',
  }),
  defineQuiz({
    id: 'log-grenzwert-25',
    typ: 'finde',
    frage: 'Lesen Sie für $a = 2{,}5$ den Grenzwert der Folge ab.',
    groesse: '$y^*$',
    ziel: 0.6,
    toleranz: 0.01,
  }),
  defineQuiz({
    id: 'log-periode-4',
    typ: 'erzeuge',
    applet: 'logistic-cobweb',
    frage: 'Stellen Sie $a$ so ein, dass die Folge auf lange Sicht mit Periode 4 umläuft.',
    pruefer: bedingung((_p, o) => {
      const per = o.periode?.value
      if (per === 4) return { status: 'richtig' }
      if (per === 2) return { status: 'nah', richtung: 'zu klein', hinweis: 'Periode 2 – noch etwas weiter.' }
      if (per === 1) return { status: 'falsch', richtung: 'zu klein', hinweis: 'Die Folge kommt noch auf einem Punkt zur Ruhe.' }
      return { status: 'falsch', richtung: 'zu groß', hinweis: per == null ? 'Kein Muster mehr zu erkennen.' : `Periode ${per}.` }
    }),
  }),
  defineQuiz({
    id: 'log-spirale-treppe',
    typ: 'antwort',
    frage:
      'Bei $a = 2{,}8$ nähert sich die Folge dem Fixpunkt abwechselnd von beiden Seiten, bei $a = 1{,}8$ von einer Seite. Woran sehen Sie das im Diagramm – und welche Rolle spielt das Vorzeichen von $f\'(y^*)$?',
    loesung: '$f\'(y^*) = 2 - a$ ist bei $a = 2{,}8$ negativ (Spirale), bei $a = 1{,}8$ positiv (Treppe).',
  }),
]
