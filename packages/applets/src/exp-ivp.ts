// MATLAB: app_exp_IVP — N' = r N, N(0) = N₀, solved by N(t) = N₀ e^{rt}. Growth or decay by the
// sign of r; the doubling (half-life) time ln 2 / |r| does not depend on N₀.

import { closedForm, klasse, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = closedForm({
  id: 'exp-ivp',
  params: {
    r: real('Wachstumsrate', { latex: 'r', min: -1.1, max: 2.1, step: 0.01, default: 0.5 }),
    N0: real('Anfangswert', { latex: 'N_0', min: 0, max: 50, step: 0.1, default: 2 }),
    T: real('Zeitfenster', { latex: 'T', min: 1, max: 30, step: 0.5, default: 10, limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  domain: (p) => [0, p.T],
  curves: { N: { label: 'N(t)', name: 'Population', f: (t, p) => p.N0 * Math.exp(p.r * t) } },
  slope: (_t, x, p) => p.r * x,
  observables: ({ p }) => {
    const td = p.r === 0 ? null : Math.LN2 / Math.abs(p.r)
    const target = p.r > 0 ? 2 * p.N0 : p.N0 / 2
    return {
      art: klasse('Verhalten', p.r > 0 ? 'Wachstum' : p.r < 0 ? 'Zerfall' : 'konstant'),
      verdopplung: zahl(p.r >= 0 ? 'Verdopplungszeit $\\ln 2 / r$' : 'Halbwertszeit $\\ln 2 / |r|$', td, {
        note: 'bei r = 0 ändert sich nichts',
        marks: td === null ? [] : [{ kind: 'time', t: td }, { kind: 'point', x: td, y: target, in: 'time' }, { kind: 'value', v: target }],
      }),
      ende: zahl('$N(T)$', p.N0 * Math.exp(p.r * p.T), { marks: [{ kind: 'point', x: p.T, y: p.N0 * Math.exp(p.r * p.T), in: 'time' }] }),
    }
  },
})

export default defineApplet({
  id: 'exp-ivp',
  titel: 'Exponentielles Wachstum',
  kurz: 'Die Änderung ist proportional zum Bestand.',
  kapitel: 'III',
  folien: '24–31',
  model,
  horizont: 'T',
  formeln: [
    { label: 'Gleichung', tex: String.raw`\frac{dN}{dt} = {{r}}{{*}}N` },
    { label: 'Start', tex: String.raw`N(0) = {{#N0}}` },
    { label: 'Lösung', tex: String.raw`N(t) = {{N0}}{{*}}e^{{{r}}\,t}` },
  ],
  plots: [
    {
      type: 'timeSeriesContinuous',
      xLabel: 't',
      yLabel: 'N(t)',
      logToggle: true,
      logHilfe: 'Wegen $\\ln N(t) = \\ln N_0 + r\\,t$ ist $N(t) = N_0 e^{rt}$ auf dieser Achse eine Gerade mit Steigung $r$.',
      y: [-5, 50],
      field: true,
      drag: [
        { param: 'N0', axis: 'y' },
        // a point on the curve at t = 2: N(2) = N₀ e^{2r}
        { param: 'r', axis: 'y', at: (p) => (p.N0 > 0 ? [2, p.N0 * Math.exp(2 * p.r)] : null), set: (_x, y, p) => ({ r: Math.log(Math.max(y, 1e-6) / p.N0) / 2 }) },
      ],
    },
  ],
  zeitleiste: true,
  layout: { main: ['r', 'N0'] },
  anzeige: ['art', 'verdopplung', 'ende'],
})
