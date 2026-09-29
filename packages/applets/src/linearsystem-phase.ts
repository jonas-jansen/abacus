// MATLAB: app_linearsystem_phase (+ app_linearsystem) — y' = A·y in the plane. Time series and
// phase plane from the same A: one island, two figures (§10). Direction field behind the orbit.

import { klasse, ode, point, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { classify, eigenReadout, ORIGIN } from './linear2'

export { classify } from './linear2'

const entry = (label: string, latex: string, def: number) => real(label, { latex, min: -3, max: 3, step: 0.05, default: def })

const model = ode({
  id: 'linearsystem',
  params: {
    a: entry('oben links', 'a_{11}', -0.5),
    b: entry('oben rechts', 'a_{12}', 1),
    c: entry('unten links', 'a_{21}', -1),
    d: entry('unten rechts', 'a_{22}', -0.5),
    start: point('Anfangswert', { latex: '\\mathbf{y}(0)', xBounds: [-4, 4], yBounds: [-4, 4], default: [3, 0] }),
    T: real('Zeitfenster', { latex: 'T', min: 1, max: 40, step: 1, default: 15, limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  components: [
    { id: 'y1', label: 'y_1(t)' },
    { id: 'y2', label: 'y_2(t)' },
  ],
  start: (p) => p.start,
  rhs: (_t, y, p) => [p.a * y[0] + p.b * y[1], p.c * y[0] + p.d * y[1]],
  tEnd: (p) => p.T,
  samples: 600,
  observables: ({ p }) => {
    const tr = p.a + p.d
    const det = p.a * p.d - p.b * p.c
    return {
      spur: zahl('Spur', tr),
      determinante: zahl('Determinante', det),
      eigenwerte: eigenReadout(p.a, p.b, p.c, p.d),
      typ: klasse('Typ', classify(tr, det), { marks: [ORIGIN] }),
    }
  },
})

export default defineApplet({
  id: 'linearsystem-phase',
  titel: 'Lineares System in der Ebene',
  kurz: 'Eine Matrix A, zwei Bilder: Zeitverlauf und Phasenporträt.',
  kapitel: 'IV',
  folien: '11–21',
  model,
  horizont: 'T',
  formeln: [
    { label: 'System', tex: String.raw`\mathbf{y}' = \begin{pmatrix} {{a}} & {{b}} \\ {{c}} & {{d}} \end{pmatrix} \mathbf{y}` },
    { label: 'Start', tex: String.raw`\mathbf{y}(0) = {{#start}}` },
  ],
  plots: [
    { type: 'phasePlane', xSeries: 'y1', ySeries: 'y2', xLabel: 'y_1', yLabel: 'y_2', x: [-4, 4], y: [-4, 4], field: true, drag: { param: 'start', axis: 'xy' } },
    { type: 'timeSeriesContinuous', xLabel: 't', yLabel: 'y(t)', y: [-6, 6] },
  ],
  layout: { main: ['a', 'b', 'c', 'd'] },
  anzeige: ['spur', 'determinante', 'eigenwerte', 'typ'],
})
