// MATLAB: app_newton_cooling — T_{n+1} = T_n − α (T_n − T^u): each step removes the fraction α
// of the distance to the room temperature. Monotone for α < 1, oscillating for 1 < α < 2,
// divergent for α > 2 — the factor 1 − α decides.

import { behaviour, iteration, klasse, real, schritte, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = iteration({
  id: 'newton-cooling',
  params: {
    alpha: real('Abkühlrate', { latex: '\\alpha', min: 0, max: 2.5, step: 0.01, default: 0.5 }),
    T0: real('Anfangstemperatur', { latex: 'T_0', min: 0, max: 60, step: 0.5, default: 35, unit: '°C' }),
    Tu: real('Raumtemperatur', { latex: 'T^u', min: 0, max: 40, step: 0.5, default: 23, unit: '°C' }),
    N: schritte('Schritte', { latex: 'N', default: 20, max: 60 }),
  },
  start: (p) => p.T0,
  step: (T, p) => T - p.alpha * (T - p.Tu),
  horizon: (p) => p.N,
  series: { id: 'T', label: 'T_n' },
  extraSeries: ({ p, n }) => [
    { id: 'Tu', label: 'T^u', kind: 'continuous', x: Float64Array.of(0, n.length - 1), y: Float64Array.of(p.Tu, p.Tu), role: 'reference' },
  ],
  observables: ({ p, x }) => {
    const q = 1 - p.alpha
    const L = p.T0 === p.Tu || Math.abs(q) < 1 ? p.Tu : q === 1 ? p.T0 : null
    const v = behaviour(x)
    return {
      faktor: zahl('Faktor $1 - \\alpha$', q),
      grenzwert: zahl('Grenzwert', L, {
        note: q === -1 ? 'springt zwischen zwei Werten' : 'Abstand wächst',
        marks: L === null ? [] : [{ kind: 'value', v: L }],
      }),
      verhalten: klasse('Verhalten', v, v === null ? { note: 'kein einfaches Muster' } : {}),
    }
  },
})

export default defineApplet({
  id: 'newton-cooling',
  titel: 'Newtonsches Abkühlen',
  kurz: 'Der Tee nähert sich der Raumtemperatur – wenn die Schritte nicht zu groß sind.',
  model,
  horizont: 'N',
  formeln: [
    { label: 'Vorschrift', tex: String.raw`T_{n+1} = T_n + {{alpha}}\,({{Tu}} - T_n)` },
    { label: 'Start', tex: String.raw`T_0 = {{#T0}}` },
    { label: 'Lösung', tex: String.raw`T_n = ({{T0}} - {{Tu}})\,(1 - {{alpha}})^n + {{Tu}}` },
  ],
  plots: [
    {
      type: 'timeSeriesDiscrete',
      xLabel: 'n',
      yLabel: 'T_n',
      series: ['T', 'Tu'],
      drag: [
        { param: 'T0', axis: 'y' },
        { param: 'Tu', axis: 'y', at: (p) => [p.N, p.Tu] },
        // T₁ = T₀ − α (T₀ − Tᵘ): the first step shows the fraction α of the gap
        {
          param: 'alpha',
          axis: 'y',
          at: (p) => (p.T0 === p.Tu || p.N < 1 ? null : [1, p.T0 - p.alpha * (p.T0 - p.Tu)]),
          set: (_x, y, p) => ({ alpha: (p.T0 - y) / (p.T0 - p.Tu) }),
        },
      ],
    },
  ],
  layout: { main: ['alpha', 'T0', 'Tu'] },
  anzeige: ['faktor', 'grenzwert', 'verhalten'],
})
