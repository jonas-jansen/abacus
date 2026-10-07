import { defineQuiz, defineWeeklyQuiz } from '@abacus/quiz/define'

/** Practice: every question can be checked while answering; as many attempts as wanted. */
export default defineWeeklyQuiz({
  id: 'woche-01',
  title: 'Folgen und Wachstum',
  description: 'Arithmetische und geometrische Folgen: Formeln, Verhalten, Modelle.',
  week: 1,
  solutions: 'while-answering',
  questions: [
    defineQuiz({
      id: 'modell',
      type: 'single',
      question: 'Eine Population wächst jedes Jahr um 5 %. Welche Folge beschreibt sie?',
      options: ['$x_{n+1} = 1.05\\,x_n$', '$x_{n+1} = x_n + 0.05$', '$x_{n+1} = 0.05\\,x_n$', '$x_{n+1} = x_n^{1.05}$'],
      correct: 0,
    }),
    defineQuiz({
      id: 'x4',
      type: 'number',
      question: 'Es sei $x_0 = 200$ und $x_{n+1} = 0.5\\,x_n$. Berechnen Sie $x_4$.',
      quantity: '$x_4$',
      target: 12.5,
      tolerance: 0.001,
      solution: '$x_4 = 0.5^4 \\cdot 200 = 200/16 = 12.5$.',
    }),
    defineQuiz({
      id: 'verhalten',
      type: 'multiple',
      question: 'Welche Aussagen über $x_n = a^n x_0$ mit $x_0 > 0$ stimmen?',
      options: [
        'Für $0 < a < 1$ konvergiert die Folge gegen $0$.',
        'Für $a = -1$ ist die Folge konstant.',
        'Für $-1 < a < 0$ wechselt das Vorzeichen bei jedem Schritt.',
        'Für $a > 1$ wächst die Folge über alle Grenzen.',
        'Für $a = 1$ divergiert die Folge.',
      ],
      correct: [0, 2, 3],
      solution: 'Für $a = -1$ springt die Folge zwischen $x_0$ und $-x_0$; für $a = 1$ ist sie konstant.',
    }),
    defineQuiz({
      id: 'zuordnung',
      type: 'match',
      question: 'Ordnen Sie jeder Folge (mit $x_0 = 1$) ihr Verhalten zu.',
      pairs: [
        ['$x_{n+1} = 2\\,x_n$', 'wächst monoton über alle Grenzen'],
        ['$x_{n+1} = 0.5\\,x_n$', 'fällt monoton gegen $0$'],
        ['$x_{n+1} = -0.5\\,x_n$', 'springt hin und her und geht gegen $0$'],
        ['$x_{n+1} = -2\\,x_n$', 'springt hin und her, der Betrag wächst'],
      ],
      distractors: ['bleibt konstant'],
    }),
    defineQuiz({
      id: 'arithmetisch',
      type: 'open',
      question: 'Warum ist die arithmetische Folge $x_{n+1} = x_n + d$ für eine wachsende Population meist ein schlechtes Modell?',
      modelAnswer:
        'Sie wächst in jedem Schritt um denselben Betrag $d$, gleich wie groß die Population ist. Der Zuwachs einer Population hängt aber davon ab, wie viele sich vermehren: doppelt so viele Tiere bekommen etwa doppelt so viele Nachkommen. Das führt auf $x_{n+1} = a\\,x_n$.',
      criteria: ['der Zuwachs der arithmetischen Folge ist immer gleich', 'der Zuwachs einer Population wächst mit ihrer Größe', 'die geometrische Folge $x_{n+1} = a\\,x_n$ als besseres Modell'],
    }),
  ],
})
