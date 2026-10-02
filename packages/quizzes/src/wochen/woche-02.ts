import { defineQuiz, defineWochenquiz } from '@abacus/quiz/define'

/** Two weeks open, three attempts, the best counts; solutions right after submitting. */
export default defineWochenquiz({
  id: 'woche-02',
  titel: 'Fixpunkte der logistischen Abbildung',
  beschreibung: 'Fixpunkte von $f(y) = a\\,y\\,(1 - y)$, ihre Stabilität und das Verhalten der Folge.',
  woche: 2,
  ab: '2026-09-28T08:00',
  bis: '2026-10-12T23:59',
  versuche: 3,
  loesungen: 'nachAbgabe',
  fragen: [
    defineQuiz({
      id: 'fixpunkt',
      typ: 'zahl',
      frage: 'Berechnen Sie den von $0$ verschiedenen Fixpunkt von $f(y) = a\\,y\\,(1-y)$ für $a = 2{,}5$.',
      groesse: '$y^*$',
      ziel: 0.6,
      toleranz: 0.001,
      loesung: '$a\\,y(1-y) = y$ mit $y \\neq 0$ gibt $1 - y = 1/a$, also $y^* = 1 - 1/a = 0{,}6$.',
    }),
    defineQuiz({
      id: 'anziehend',
      typ: 'einfach',
      frage: 'Ein Fixpunkt $y^*$ einer differenzierbaren Abbildung $f$ ist anziehend, wenn …',
      optionen: ["$|f'(y^*)| < 1$", "$f'(y^*) > 0$", '$f(y^*) = 0$', "$|f'(y^*)| > 1$"],
      richtig: 0,
    }),
    defineQuiz({
      id: 'ableitung',
      typ: 'zahl',
      frage: "Berechnen Sie $f'(y^*)$ für $a = 2{,}5$ am Fixpunkt $y^* = 0{,}6$.",
      groesse: "$f'(y^*)$",
      ziel: -0.5,
      toleranz: 0.001,
      loesung: "$f'(y) = a\\,(1 - 2y)$, also $f'(0{,}6) = 2{,}5 \\cdot (1 - 1{,}2) = -0{,}5$.",
    }),
    defineQuiz({
      id: 'stabil',
      typ: 'mehrfach',
      frage: 'Für welche $a$ ist der Fixpunkt $y^* = 1 - 1/a$ anziehend?',
      optionen: ['$a = 0{,}5$', '$a = 1{,}5$', '$a = 2{,}8$', '$a = 3{,}2$', '$a = 3{,}9$'],
      richtig: [1, 2],
      mischen: false,
      loesung: "$f'(y^*) = 2 - a$, also anziehend genau für $|2 - a| < 1$, d. h. $1 < a < 3$.",
    }),
    defineQuiz({
      id: 'langfristig',
      typ: 'zuordnung',
      frage: 'Ordnen Sie jedem $a$ das langfristige Verhalten der Folge zu (Start $y_0 = 0{,}2$).',
      paare: [
        ['$a = 0{,}8$', 'stirbt aus: $y_n \\to 0$'],
        ['$a = 2{,}8$', 'kommt zur Ruhe auf $1 - 1/a$'],
        ['$a = 3{,}2$', 'pendelt zwischen zwei Werten'],
        ['$a = 3{,}9$', 'kein erkennbares Muster'],
      ],
      ablenker: ['wächst über alle Grenzen'],
    }),
    defineQuiz({
      id: 'seiten',
      typ: 'antwort',
      frage: 'Warum nähert sich die Folge für $a = 2{,}8$ dem Fixpunkt abwechselnd von beiden Seiten, für $a = 1{,}8$ aber von einer Seite?',
      musterloesung:
        "Nahe am Fixpunkt gilt für den Abstand $e_n = y_n - y^*$ ungefähr $e_{n+1} \\approx f'(y^*)\\,e_n$ mit $f'(y^*) = 2 - a$. Für $a = 1{,}8$ ist $f'(y^*) = 0{,}2 > 0$: der Abstand behält sein Vorzeichen. Für $a = 2{,}8$ ist $f'(y^*) = -0{,}8 < 0$: das Vorzeichen wechselt in jedem Schritt.",
      kriterien: ["Linearisierung $e_{n+1} \\approx f'(y^*)\\,e_n$", "$f'(y^*) = 2 - a$", 'negatives Vorzeichen: Seitenwechsel; positives: von einer Seite'],
    }),
  ],
})
