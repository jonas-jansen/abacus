// MATLAB: app_predator_prey_updatefun — the predator–prey update as two surfaces over the
// (y₁, y₂) plane. Coloured by whether the population grows (f_i > y_i) or shrinks; the curve
// f_i = y_i separates the two.

import { choice, defineModel, klasse, linspace, liste, point, real, zahl, type Grid, type Observable, type Point } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { predNext, preyNext } from './predator-prey'

const M = 36
const AX = linspace(0, 1.5, M)

type P = { r: number; gamma: number; teil: 'beute' | 'raeuber'; y: Point }

const model = defineModel({
  id: 'predator-prey-map',
  kind: 'closedForm',
  params: {
    teil: choice(
      'Komponente',
      [
        { value: 'beute', label: 'Beute f₁' },
        { value: 'raeuber', label: 'Räuber f₂' },
      ],
      'beute',
    ),
    r: real('Wachstumsrate der Beute', { latex: 'r', min: 0, max: 4, step: 0.01, default: 2.5 }),
    gamma: real('Jagderfolg', { latex: '\\gamma', min: 0, max: 2.5, step: 0.01, default: 1 }),
    y: point('Zustand', { latex: '\\mathbf{y}', xBounds: [0, 1.5], yBounds: [0, 1.5], default: [0.6, 0.4] }),
  },
  run(p: P, opts) {
    const prey = p.teil === 'beute'
    const z = new Float64Array(M * M)
    const ref = new Float64Array(M * M)
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        const [y1, y2] = [AX[i], AX[j]]
        z[j * M + i] = prey ? preyNext(y1, y2, p.r, p.gamma) : predNext(y1, y2, p.gamma)
        ref[j * M + i] = prey ? y1 : y2
      }
    }
    const coexist = p.gamma > 1
    const eq: [number, number] = coexist ? [1 / p.gamma, (p.r * (1 - 1 / p.gamma)) / p.gamma] : [1, 0]
    const grid: Grid = {
      id: 'f',
      label: prey ? 'f_1' : 'f_2',
      x: AX,
      y: AX,
      z,
      ref,
      refLabel: prey ? 'y_1' : 'y_2',
      marker: p.y,
    }
    const [y1, y2] = p.y
    const f1 = preyNext(y1, y2, p.r, p.gamma)
    const f2 = predNext(y1, y2, p.gamma)
    return {
      series: [],
      grids: [grid],
      observables: (opts.observables === false
        ? {}
        : {
            f: liste('$(f_1, f_2)$ im Punkt', [f1, f2]),
            beute: klasse('Beute', f1 > y1 ? 'wächst' : f1 < y1 ? 'schrumpft' : 'bleibt'),
            raeuber: klasse('Räuber', f2 > y2 ? 'wachsen' : f2 < y2 ? 'schrumpfen' : 'bleiben'),
            gleichgewicht: liste(coexist ? 'Koexistenz $(y_1^*, y_2^*)$' : 'Gleichgewicht ohne Räuber', eq),
            abstand: zahl('Abstand zum Gleichgewicht', Math.hypot(y1 - eq[0], y2 - eq[1]), { digits: 3 }),
          }) as Record<string, Observable>,
      meta: {},
    }
  },
})

export default defineApplet({
  id: 'predator-prey-map',
  model,
  formeln: [
    { label: 'Update-Funktion', tex: String.raw`f_1(y_1, y_2) = (1 + {{r}})\,y_1 - {{r}}{{*}}y_1^2 - {{gamma}}{{*}}y_1 y_2 \\ f_2(y_1, y_2) = {{gamma}}{{*}}y_1 y_2` },
    { label: 'Punkt', tex: String.raw`\mathbf{y} = {{#y}}` },
    { label: 'Fläche', tex: String.raw`{{teil}}` },
  ],
  plots: [{ type: 'surface3d', grid: 'f', xLabel: 'y_1', yLabel: 'y_2', drag: { param: 'y', axis: 'xy' } }],
  layout: { main: ['teil', 'r', 'gamma', 'y'] },
  anzeige: ['f', 'beute', 'raeuber', 'gleichgewicht'],
})
