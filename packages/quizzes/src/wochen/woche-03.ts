import { defineQuiz, defineWochenquiz } from '@abacus/quiz/define'

/** One attempt; results and solutions only after the deadline. */
export default defineWochenquiz({
  id: 'woche-03',
  titel: 'Exponentielles und logistisches Wachstum',
  beschreibung: 'Differentialgleichungen erster Ordnung: Lösungen, Verdopplungszeit, Sättigung.',
  woche: 3,
  ab: '2026-10-12T08:00',
  bis: '2026-10-26T23:59',
  versuche: 1,
  loesungen: 'nachFrist',
  fragen: [
    defineQuiz({
      id: 'verdopplung',
      typ: 'zahl',
      frage: "Es sei $N' = 0{,}2\\,N$ mit $N(0) = 100$. Nach welcher Zeit hat sich $N$ verdoppelt? (auf zwei Nachkommastellen)",
      groesse: '$t$',
      ziel: Math.log(2) / 0.2,
      toleranz: 0.01,
      loesung: '$e^{0{,}2\\,t} = 2 \\iff t = \\ln 2 / 0{,}2 \\approx 3{,}47$.',
    }),
    defineQuiz({
      id: 'logistisch',
      typ: 'einfach',
      frage: "Die Lösung von $N' = r\\,N\\,(1 - N/K)$ mit $r > 0$ und $0 < N(0) < K$ …",
      optionen: ['wächst monoton gegen $K$', 'wächst über alle Grenzen', 'schwingt um $K$', 'fällt gegen $0$'],
      richtig: 0,
    }),
    defineQuiz({
      id: 'loesungen',
      typ: 'zuordnung',
      frage: 'Ordnen Sie jeder Gleichung ihre allgemeine Lösung zu.',
      paare: [
        ["$y' = 2\\,y$", '$y = C\\,e^{2t}$'],
        ["$y' = -y$", '$y = C\\,e^{-t}$'],
        ["$y' = 2$", '$y = 2t + C$'],
      ],
      ablenker: ['$y = C\\,t^2$'],
    }),
    defineQuiz({
      id: 'schnellstes',
      typ: 'antwort',
      frage: 'Bei welcher Größe $N$ wächst die logistische Lösung am schnellsten, und warum?',
      musterloesung: "Bei $N = K/2$. Die Wachstumsrate $N' = r\\,N\\,(1 - N/K)$ ist als Funktion von $N$ eine nach unten geöffnete Parabel mit den Nullstellen $0$ und $K$; ihr Maximum liegt in der Mitte.",
      kriterien: ['$N = K/2$', "$N'$ als Parabel in $N$", 'Maximum zwischen den Nullstellen $0$ und $K$'],
    }),
  ],
})
