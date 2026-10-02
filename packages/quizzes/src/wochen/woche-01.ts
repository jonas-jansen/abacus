import { defineQuiz, defineWochenquiz } from '@abacus/quiz/define'

/** Practice: every question can be checked while answering; as many attempts as wanted. */
export default defineWochenquiz({
  id: 'woche-01',
  titel: 'Folgen und Wachstum',
  beschreibung: 'Arithmetische und geometrische Folgen: Formeln, Verhalten, Modelle.',
  woche: 1,
  loesungen: 'sofort',
  fragen: [
    defineQuiz({
      id: 'modell',
      typ: 'einfach',
      frage: 'Eine Population wächst jedes Jahr um 5 %. Welche Folge beschreibt sie?',
      optionen: ['$x_{n+1} = 1{,}05\\,x_n$', '$x_{n+1} = x_n + 0{,}05$', '$x_{n+1} = 0{,}05\\,x_n$', '$x_{n+1} = x_n^{1{,}05}$'],
      richtig: 0,
    }),
    defineQuiz({
      id: 'x4',
      typ: 'zahl',
      frage: 'Es sei $x_0 = 200$ und $x_{n+1} = 0{,}5\\,x_n$. Berechnen Sie $x_4$.',
      groesse: '$x_4$',
      ziel: 12.5,
      toleranz: 0.001,
      loesung: '$x_4 = 0{,}5^4 \\cdot 200 = 200/16 = 12{,}5$.',
    }),
    defineQuiz({
      id: 'verhalten',
      typ: 'mehrfach',
      frage: 'Welche Aussagen über $x_n = a^n x_0$ mit $x_0 > 0$ stimmen?',
      optionen: [
        'Für $0 < a < 1$ konvergiert die Folge gegen $0$.',
        'Für $a = -1$ ist die Folge konstant.',
        'Für $-1 < a < 0$ wechselt das Vorzeichen bei jedem Schritt.',
        'Für $a > 1$ wächst die Folge über alle Grenzen.',
        'Für $a = 1$ divergiert die Folge.',
      ],
      richtig: [0, 2, 3],
      loesung: 'Für $a = -1$ springt die Folge zwischen $x_0$ und $-x_0$; für $a = 1$ ist sie konstant.',
    }),
    defineQuiz({
      id: 'zuordnung',
      typ: 'zuordnung',
      frage: 'Ordnen Sie jeder Folge (mit $x_0 = 1$) ihr Verhalten zu.',
      paare: [
        ['$x_{n+1} = 2\\,x_n$', 'wächst monoton über alle Grenzen'],
        ['$x_{n+1} = 0{,}5\\,x_n$', 'fällt monoton gegen $0$'],
        ['$x_{n+1} = -0{,}5\\,x_n$', 'springt hin und her und geht gegen $0$'],
        ['$x_{n+1} = -2\\,x_n$', 'springt hin und her, der Betrag wächst'],
      ],
      ablenker: ['bleibt konstant'],
    }),
    defineQuiz({
      id: 'arithmetisch',
      typ: 'antwort',
      frage: 'Warum ist die arithmetische Folge $x_{n+1} = x_n + d$ für eine wachsende Population meist ein schlechtes Modell?',
      musterloesung:
        'Sie wächst in jedem Schritt um denselben Betrag $d$, gleich wie groß die Population ist. Der Zuwachs einer Population hängt aber davon ab, wie viele sich vermehren: doppelt so viele Tiere bekommen etwa doppelt so viele Nachkommen. Das führt auf $x_{n+1} = a\\,x_n$.',
      kriterien: ['der Zuwachs der arithmetischen Folge ist immer gleich', 'der Zuwachs einer Population wächst mit ihrer Größe', 'die geometrische Folge $x_{n+1} = a\\,x_n$ als besseres Modell'],
    }),
  ],
})
