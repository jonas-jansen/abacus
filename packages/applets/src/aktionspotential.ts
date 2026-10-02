// Cardiac action potential as a map (slides II 61–65): potential y₁ and recovery variable y₂,
//   y₁(n+1) = y₁(n)² e^{y₂(n) − y₁(n)} + k,   y₂(n+1) = a y₂(n) − b y₁(n) + c,
// y₂ starting at its rest value c/(1 − a). With b = 0,26 the cell fires periodically; with
// b = 0,18 extra small spikes appear between the action potentials — chaotic early
// afterdepolarisations (EADs); with b = 0,6 and k = 0,02 it rests and answers one stimulus.

import { detectPeriod, iterationN, klasse, index, real, schritte } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

type P = { a: number; b: number; c: number; k: number }

/** Spikes: steps where y₁ rises above `level` (the upstroke of an action potential). */
function spikes(y1: ArrayLike<number>, level = 3): number[] {
  const out: number[] = []
  for (let n = 1; n < y1.length; n++) if (y1[n - 1] < level && y1[n] >= level) out.push(n)
  return out
}

/** y₁ over `steps` steps (for the long-term behaviour, whatever N is shown). */
function potential(p: P & { y10: number }, steps: number): Float64Array {
  const out = new Float64Array(steps + 1)
  let [y1, y2] = [p.y10, p.c / (1 - p.a)]
  out[0] = y1
  for (let n = 1; n <= steps; n++) {
    ;[y1, y2] = [y1 * y1 * Math.exp(y2 - y1) + p.k, p.a * y2 - p.b * y1 + p.c]
    out[n] = y1
  }
  return out
}

const model = iterationN({
  id: 'aktionspotential',
  params: {
    a: real('Erholung', { latex: 'a', min: 0, max: 0.99, step: 0.01, default: 0.89, limits: { min: 0, max: 0.999, reason: 'Für 0 < a < 1 gibt es den Ruhewert c/(1 − a).' } }),
    b: real('Rückkopplung', { latex: 'b', min: 0, max: 1, step: 0.01, default: 0.26 }),
    c: real('Zufluss', { latex: 'c', min: 0, max: 1, step: 0.01, default: 0.28 }),
    k: real('Reiz', { latex: 'k', min: 0, max: 0.1, step: 0.001, default: 0.03 }),
    y10: real('Anfangspotential', { latex: 'y_1(0)', min: 0, max: 3, step: 0.01, default: 0.2 }),
    N: schritte('Schritte', { latex: 'N', default: 180, max: 2000 }),
  },
  components: [
    { id: 'y1', label: 'y_1', name: 'Potential', role: 'primary' },
    { id: 'y2', label: 'y_2', name: 'Erholung', role: 'secondary' },
  ],
  start: (p) => [p.y10, p.c / (1 - p.a)],
  step: ([y1, y2], p) => [y1 * y1 * Math.exp(y2 - y1) + p.k, p.a * y2 - p.b * y1 + p.c],
  horizon: (p) => p.N,
  observables: ({ p, x: [y1] }) => {
    // long-term behaviour from a long run
    const long = potential(p, 3000)
    const tail = long.subarray(long.length - 400)
    const periode = detectPeriod(tail, { maxPeriod: 120, tol: 1e-6 })
    const sp = spikes(y1)
    let max = 0
    for (const v of tail) max = Math.max(max, v)
    const art = max < 1 ? 'Ruhe' : periode !== null ? 'regelmäßige Aktionspotentiale' : 'unregelmäßig: EADs'
    return {
      art: klasse('Die Zelle', art, art === 'unregelmäßig: EADs' ? { note: 'kleine Zacken zwischen den Aktionspotentialen, ohne Periode' } : {}),
      periode: index('Periode (Schritte)', periode, periode === null && art !== 'Ruhe' ? { note: 'keine Periode ≤ 120' } : {}),
      anzahl: index('Aktionspotentiale bis $N$', sp.length, { marks: sp.map((t, item) => ({ kind: 'time' as const, t, item })) }),
    }
  },
})

export default defineApplet({
  id: 'aktionspotential',
  model,
  horizont: 'N',
  formeln: [
    { label: 'Modell', tex: String.raw`y_1(n+1) = y_1(n)^2\,e^{y_2(n) - y_1(n)} + {{k}} \\ y_2(n+1) = {{a}}{{*}}y_2(n) - {{b}}{{*}}y_1(n) + {{c}}` },
    { label: 'Start', tex: String.raw`y_1(0) = {{#y10}} \\ y_2(0) = \frac{c}{1 - a}` },
  ],
  plots: [
    { type: 'timeSeriesDiscrete', series: ['y1'], title: 'Potential', xLabel: 'n', yLabel: 'y_1(n)', drag: { param: 'y10', axis: 'y' } },
    { type: 'timeSeriesDiscrete', series: ['y2'], title: 'Erholungsvariable', xLabel: 'n', yLabel: 'y_2(n)' },
  ],
  layout: { main: ['b', 'k'] },
  anzeige: ['art', 'periode', 'anzahl'],
  szenarien: [
    { label: 'spontan, b = 0,26', text: 'regelmäßige Aktionspotentiale (Folie 63 links)', params: {} },
    { label: 'EADs, b = 0,18', text: 'chaotische frühe Nachdepolarisationen (Folie 63 rechts)', params: { b: 0.18, N: 210 } },
    { label: 'aus der Ruhe', text: 'b = 0,6, k = 0,02: eine Anregung, dann wieder Ruhe (Folie 64)', params: { b: 0.6, k: 0.02, y10: 0.3, N: 30 } },
  ],
})
