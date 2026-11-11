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
  {
    id: '2',
    title: 'Übungsblatt 2',
    parts: [
      { id: '2.1', tab: '2.1', title: 'Zellkultur mit Verdünnung', applet: 'blatt2-zellkultur' },
      { id: '2.2', tab: '2.2', title: 'Klatschmohn', applet: 'blatt2-mohn' },
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
  {
    id: 'anhang-a',
    title: 'Anhang A: Mathematische Werkzeuge',
    parts: [
      { id: 'f3', tab: '3–4', title: 'Grenzwert: die Idee', applet: 'va-grenzwert' },
      { id: 'f5', tab: '5', title: 'Konvergenz der Folge 1/n', applet: 'va-eins-durch-n' },
      { id: 'f6', tab: '6', title: 'Konvergent oder divergent?', applet: 'va-folgen-6' },
      { id: 'f7', tab: '7', title: 'Konvergent oder divergent?', applet: 'va-folgen-7' },
      { id: 'f13', tab: '13', title: 'Stetigkeit: die Idee', applet: 'va-stetig' },
      { id: 'f14', tab: '14', title: 'Stetigkeit: Definition', applet: 'va-stetig-folge' },
      { id: 'f16', tab: '16', title: 'Beispiel: eine unstetige Funktion', applet: 'va-unstetig' },
      { id: 'f18', tab: '18', title: 'Beispiel: Heron-Verfahren', applet: 'va-heron' },
      { id: 'f19', tab: '19', title: 'Grenzwert einer Funktion für x → a', applet: 'va-grenzwert-a' },
      { id: 'f20', tab: '20', title: 'Grenzwert einer Funktion für x → ∞', applet: 'va-grenzwert-unendlich' },
      { id: 'f22', tab: '22', title: 'Differenzenquotient', applet: 'va-sekante' },
      { id: 'f23', tab: '23', title: 'Differenzenquotient als Funktion von h', applet: 'va-quotient' },
      { id: 'f24', tab: '24–25', title: 'Ableitung und Tangente', applet: 'va-tangente' },
      { id: 'f26', tab: '26', title: 'Blick durch die Lupe', applet: 'va-lupe' },
      { id: 'f30', tab: '27–30', title: 'Ableitungsfunktion', applet: 'va-ableitungsfunktion' },
    ],
  },
  {
    id: 'stabilitaet',
    title: 'Kapitel 1: Stationäre Zustände und Stabilität',
    parts: [
      { id: 'rueckblick', tab: 'Rückblick', title: 'Rückblick und Konvergenz', applet: 'vs-rueckblick' },
      { id: 'stetigkeit', tab: 'Stetigkeit', title: 'Wiederholung: Stetigkeit', applet: 'vs-stetigkeit' },
      { id: 'ableitung', tab: 'Ableitung', title: 'Wiederholung: Ableitung', applet: 'vs-ableitung' },
      { id: 'tangente', tab: 'Tangente', title: 'Wiederholung: Tangente', applet: 'vs-tangente' },
      { id: 'f36', tab: '36', title: 'Stationäre Zustände grafisch', applet: 'vs-fixpunkte-36' },
      { id: 'f37', tab: '37', title: 'Beispiel: Medikament', applet: 'vs-fixpunkte-37' },
      { id: 'f38', tab: '38', title: 'Gibt es immer einen stationären Zustand?', applet: 'vs-fixpunkte-38' },
      { id: 'f39', tab: '39', title: 'Beispiel: Wurzelfunktion', applet: 'vs-fixpunkte-39' },
      { id: 'f40', tab: '40', title: 'Beispiel: logistisches Wachstum', applet: 'vs-fixpunkte-40' },
      { id: 'f41', tab: '41', title: 'Welches Langzeitverhalten ist möglich?', applet: 'vs-langzeit-41' },
      { id: 'f42', tab: '42', title: 'Was der Satz nicht sagt', applet: 'vs-langzeit-42' },
      { id: 'f44', tab: '44', title: 'Das Spinnwebdiagramm', applet: 'vs-spinnweb-44' },
      { id: 'f45', tab: '45', title: 'Lineare Differenzengleichung mit 0 < a < 1', applet: 'vs-spinnweb-45' },
      { id: 'f46', tab: '46', title: 'Lineare Differenzengleichung mit a > 1', applet: 'vs-spinnweb-46' },
      { id: 'f47', tab: '47', title: 'Lineare Differenzengleichung mit a < 0', applet: 'vs-spinnweb-47' },
      { id: 'f48', tab: '48', title: 'Langzeitverhalten linearer Differenzengleichungen', applet: 'vs-spinnweb-48' },
      { id: 'f51', tab: '51', title: 'Nichtlineare Beispiele', applet: 'vs-spinnweb-51' },
      { id: 'f55', tab: '53–55', title: 'Stabilität bei der Wurzelfunktion', applet: 'vs-spinnweb-55' },
      { id: 'f56', tab: '56', title: 'Blick durch die Lupe: 0 < f′(x*) < 1', applet: 'vs-lupe-56' },
      { id: 'f57', tab: '57', title: 'Blick durch die Lupe: f′(x*) > 1', applet: 'vs-lupe-57' },
      { id: 'f58', tab: '58', title: 'Blick durch die Lupe: −1 < f′(x*) < 0', applet: 'vs-lupe-58' },
      { id: 'f59', tab: '59', title: 'Blick durch die Lupe: f′(x*) < −1', applet: 'vs-lupe-59' },
      { id: 'f64', tab: '63–64', title: 'Stabilität im Bifurkationsdiagramm', applet: 'vs-bifurkation' },
      { id: 'f68', tab: '68', title: 'Idee 1: einfach iterieren', applet: 'vs-spinnweb-68' },
      { id: 'f69', tab: '69–72', title: 'Das Newton-Verfahren', applet: 'vs-newton' },
      { id: 'f73', tab: '73', title: 'Stabilität numerisch entscheiden', applet: 'vs-numerisch' },
    ],
  },
]
