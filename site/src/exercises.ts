/**
 * Exercise sheets: one page per sheet (/<course>/uebung/<id>) for the exercise class, a tab
 * per part, each with its equation box and a scenario applet (packages/applets/src/exercises).
 * The sheets themselves (PDF) stay out of the repository's site.
 */

export interface SheetPart {
  /** Anchor and tab: '1.1a' → …/uebung/1#1.1a. */
  id: string
  /** On the tab, e.g. "1.1 a". */
  tab: string
  /** What it is about, e.g. "Höhe einer Sonnenblume". */
  title: string
  /** The exercise applet (packages/applets/src/exercises). */
  applet: string
}

export interface Sheet {
  id: string
  title: string
  parts: readonly SheetPart[]
}

export const sheets: readonly Sheet[] = [
  {
    id: '1',
    title: 'Übungsblatt 1',
    parts: [
      { id: '1.1a', tab: '1.1 a', title: 'Höhe einer Sonnenblume', applet: 'blatt1-sonnenblume' },
      { id: '1.1b', tab: '1.1 b', title: 'Wirkstoffmenge im Blut', applet: 'blatt1-wirkstoff' },
      { id: '1.1c', tab: '1.1 c', title: 'Insekten mit zweijährigem Zyklus', applet: 'blatt1-insekten' },
      { id: '1.2', tab: '1.2', title: 'Fischpopulation nach Beverton und Holt', applet: 'blatt1-fische' },
      { id: '1.3', tab: '1.3', title: 'Eine Lösungsformel erraten', applet: 'blatt1-fische-formel' },
      { id: '1.4', tab: '1.4', title: 'Escherichia coli', applet: 'blatt1-ecoli' },
      { id: '1.5', tab: '1.5', title: 'Welse im Teich', applet: 'blatt1-welse' },
    ],
  },
]

/**
 * Lectures: one page per slide set (/<course>/vorlesung/<id>) with the applets of its
 * visualisations, a tab per slide, fully interactive, for the beamer
 * (packages/applets/src/lectures). Only in the beta on GitHub Pages.
 */
export const lectures: readonly Sheet[] = [
  {
    id: '1b',
    title: 'Kapitel 1b: Differenzengleichungen',
    parts: [
      { id: 'f3', tab: '3', title: 'Beispiel: Aktualisierungsfunktion', applet: 'v1b-heron' },
      { id: 'f14', tab: '14', title: 'Lösungsformel der arithmetischen Progression', applet: 'v1b-arithmetisch' },
      { id: 'f16', tab: '16', title: 'Lösungsformel der geometrischen Progression', applet: 'v1b-geometrisch' },
      { id: 'f18', tab: '18', title: 'Arithmetisch oder geometrisch?', applet: 'v1b-wettlauf' },
      { id: 'f20', tab: '19–20', title: 'Lineare Differenzengleichung: Medikament', applet: 'v1b-linear' },
      { id: 'f22', tab: '22–23', title: 'Newtonsches Gesetz der Abkühlung', applet: 'v1b-abkuehlung' },
      { id: 'f25', tab: '25', title: 'Veränderliche Wachstumsrate', applet: 'v1b-rate' },
      { id: 'f27', tab: '27', title: 'Aktualisierungsfunktion des logistischen Wachstums', applet: 'v1b-logistisch-f' },
      { id: 'f29', tab: '29', title: 'Parameterstudie', applet: 'v1b-parameterstudie' },
      { id: 'f31', tab: '30–32', title: 'Langzeitverhalten und Bifurkationsdiagramm', applet: 'v1b-bifurkation' },
      { id: 'f33', tab: '33', title: 'Sensitive Abhängigkeit vom Anfangswert', applet: 'v1b-chaos' },
    ],
  },
]
