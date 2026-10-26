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
