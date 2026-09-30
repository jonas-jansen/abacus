// MATLAB: app_geometric — x_{n+1} = a·x_n. Build order #1: the whole pipeline on a trivial iteration.

import { iteration, real, schritte, verhalten, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = iteration({
  id: 'geometric',
  params: {
    a: real('Faktor', { latex: 'a', min: -2, max: 2, step: 0.01, default: 0.8 }),
    x0: real('Startwert', { latex: 'x_0', min: -10, max: 10, step: 0.1, default: 5 }),
    N: schritte('Schritte', { latex: 'N', default: 25, max: 80 }),
  },
  start: (p) => p.x0,
  step: (x, p) => p.a * x,
  horizon: (p) => p.N,
  series: { label: 'x_n' },
  observables: ({ p, x }) => {
    // x_n = aⁿ·x₀: the limit follows from a alone, however many steps are drawn.
    const L = p.x0 === 0 || Math.abs(p.a) < 1 ? 0 : p.a === 1 ? p.x0 : null
    return {
      verhalten: verhalten('Verhalten', x),
      grenzwert: zahl('Grenzwert', L, {
        note: p.a === -1 ? 'springt zwischen zwei Werten' : 'wächst über alle Grenzen',
        marks: L === null ? [] : [{ kind: 'value', v: L }],
      }),
    }
  },
})

export default defineApplet({
  id: 'geometric',
  titel: 'Geometrische Folge',
  kurz: 'Jeder Wert ist das a-fache des vorigen.',
  kapitel: 'I',
  folien: '24–25, 30–31',
  model,
  horizont: 'N',
  formeln: [
    { label: 'Vorschrift', tex: String.raw`x_{n+1} = {{a}}{{*}}x_n` },
    { label: 'Start', tex: String.raw`x_0 = {{#x0}}` },
    { label: 'Lösung', tex: String.raw`x_n = {{(a)}}^{n}{{*}}{{x0}}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      xLabel: 'n',
      yLabel: 'x_n',
      logToggle: true,
      logHilfe: 'Eine geometrische Folge $x_n = a^n x_0$ ist auf dieser Achse eine Gerade: jeder Schritt multipliziert mit $a$. Negative Werte (bei $a < 0$) fehlen.',
      drag: [
        { param: 'x0', axis: 'y' },
        // x₁ = a·x₀: dragging the second point sets the factor
        { param: 'a', axis: 'y', at: (p) => (p.x0 === 0 || p.N < 1 ? null : [1, p.a * p.x0]), set: (_x, y, p) => ({ a: y / p.x0 }) },
      ],
    },
  ],
  anzeige: ['grenzwert', 'verhalten'],
})
