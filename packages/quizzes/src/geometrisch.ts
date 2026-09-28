import { bedingung, schwelle, zahlText } from '@abacus/applet-core'
import { defineQuiz } from '@abacus/quiz/define'

export default [
  defineQuiz({
    id: 'geo-vorhersage-negativ',
    typ: 'vorhersage',
    frage: 'Was macht die Folge für $a = -0{,}9$ und $x_0 = 5$?',
    optionen: ['Sie wächst über alle Grenzen.', 'Sie springt hin und her und wird kleiner.', 'Sie springt hin und her und wird größer.', 'Sie bleibt konstant.'],
  }),
  defineQuiz({
    id: 'geo-formel',
    typ: 'antwort',
    frage: 'Geben Sie eine Formel für $x_n$ an, in der nur $a$, $x_0$ und $n$ vorkommen.',
    tipps: ['Schreiben Sie $x_1, x_2, x_3$ mit $x_0$ aus.'],
    loesung: '$x_n = a^n x_0$, per Induktion: $x_{n+1} = a\\,x_n = a \\cdot a^n x_0 = a^{n+1} x_0$.',
  }),
  defineQuiz({
    id: 'geo-konstant',
    typ: 'finde',
    applet: 'geometric',
    frage: 'Für welches $a$ bleibt die Folge bei $x_0 \\neq 0$ konstant?',
    groesse: '$a$',
    toleranz: 0.005,
    pruefer: schwelle({
      ziel: 1,
      toleranz: 0.005,
      zuKlein: (v) => (v > 0 ? `Bei $a = ${zahlText(v)}$ schrumpft die Folge noch.` : 'Bei negativem $a$ springt das Vorzeichen.'),
      zuGross: (v) => `Bei $a = ${zahlText(v)}$ wächst die Folge.`,
    }),
    loesung: '$a = 1$: dann ist $x_{n+1} = x_n$ für alle $n$. Für jedes andere $a$ ändert sich $x_n = a^n x_0$ mit $n$.',
  }),
  defineQuiz({
    id: 'geo-oszilliert',
    typ: 'erzeuge',
    applet: 'geometric',
    frage: 'Stellen Sie $a$ so ein, dass die Folge bei jedem Schritt das Vorzeichen wechselt **und** dabei schrumpft.',
    pruefer: bedingung((p, o) =>
      o.verhalten?.value === 'oszillierend' && Math.abs(p.a as number) < 1
        ? { status: 'richtig' }
        : o.verhalten?.value !== 'oszillierend'
          ? { status: 'falsch', hinweis: 'Die Folge wechselt noch nicht das Vorzeichen. Welches $a$ bewirkt das?' }
          : { status: 'nah', hinweis: 'Sie springt – aber schrumpft sie auch?' },
    ),
  }),
  defineQuiz({
    id: 'geo-unter-001',
    typ: 'finde',
    frage: 'Es sei $a = 0{,}5$ und $x_0 = 5$. Ab welchem $n$ ist $x_n < 0{,}01$? Erst rechnen, dann nachsehen.',
    groesse: '$n$',
    ziel: 9,
    tipps: ['Lösen Sie $5 \\cdot 0{,}5^n < 0{,}01$ mit dem Logarithmus.'],
    loesung: '$0{,}5^n < 0{,}002 \\iff n > \\log 0{,}002 / \\log 0{,}5 \\approx 8{,}97$, also ab $n = 9$.',
  }),
]
