// Anhang, Blick durch die Lupe: near a, f looks like its tangent t(x) = f(a) + f′(a)(x − a).
// Zooming in on (a, f(a)) — the same factor on both axes — the curve straightens out until it
// cannot be told apart from the tangent.

import { choice, closedForm, real, sample, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'
import { FUNKTIONEN, funktionOptionen, inDomain, type FunktionId } from './funktionen'

const IDS = ['x2', 'x3', 'poly', 'inv', 'sqrt', 'exp', 'sin'] as const satisfies readonly FunktionId[]

type P = { f: FunktionId; a: number; zoom: number }

/** Half the width of the window. */
const halb = (p: P) => 2 / p.zoom

const model = closedForm({
  id: 'lupe',
  params: {
    f: choice('Funktion', funktionOptionen(IDS), 'poly'),
    a: real('Stelle', { latex: 'a', min: -2, max: 2, step: 0.01, default: 1 }),
    zoom: real('Vergrößerung', { latex: 'z', min: 1, max: 1000, step: 0.1, default: 1, scale: 'log', limits: { min: 1, max: 1e6, reason: 'Vergrößerung zwischen 1 und einer Million.' } }),
  },
  normalize: (p) => {
    const a = inDomain(p.f, p.a)
    return a === p.a ? p : { ...p, a }
  },
  constraintNote: 'a liegt im Definitionsbereich von f',
  domain: (p) => [p.a - halb(p), p.a + halb(p)],
  samples: 400,
  curves: {
    f: { label: 'f(x)', f: (x, p) => FUNKTIONEN[p.f].f(x) },
    t: { label: 't(x)', name: 'Tangente', role: 'reference', f: (x, p) => FUNKTIONEN[p.f].f(p.a) + FUNKTIONEN[p.f].df(p.a) * (x - p.a) },
  },
  observables: ({ p }) => {
    const F = FUNKTIONEN[p.f]
    const w = halb(p)
    // largest gap between curve and tangent in the window, relative to its width
    const dev = sample((x) => Math.abs(F.f(x) - F.f(p.a) - F.df(p.a) * (x - p.a)), p.a - w, p.a + w, 201)
    let m = 0
    for (const v of dev.y) if (Number.isFinite(v)) m = Math.max(m, v)
    return {
      steigung: zahl("Steigung $f'(a)$", F.df(p.a), { marks: [{ kind: 'line', x: p.a, y: F.f(p.a), slope: F.df(p.a), in: 'map' }] }),
      abstand: zahl('größter Abstand zur Tangente', m, { digits: 3 }),
      relativ: zahl('… im Verhältnis zur Fensterbreite', m / (2 * w), { digits: 3 }),
    }
  },
})

export default defineApplet({
  id: 'lupe',
  titel: 'Blick durch die Lupe',
  kurz: 'Aus der Nähe betrachtet ist jede glatte Kurve eine Gerade: ihre Tangente.',
  kapitel: 'Anhang',
  folien: '25–27',
  model,
  formeln: [
    { label: 'Funktion', tex: String.raw`f(x) = {{f}}` },
    { label: 'Tangente', tex: String.raw`t(x) = f({{a}}) + f'({{a}})\,(x - {{a}})` },
    { label: 'Ausschnitt', tex: String.raw`|x - {{a}}| \le \frac{2}{{{zoom}}}` },
  ],
  plots: [
    {
      type: 'functionGraph',
      series: ['f', 't'],
      xLabel: 'x',
      yLabel: 'y',
      aspect: 1,
      // same scale on both axes, centred on the point: zooming keeps the angle of the tangent
      y: (p) => [FUNKTIONEN[p.f].f(p.a) - halb(p), FUNKTIONEN[p.f].f(p.a) + halb(p)],
      drag: [{ param: 'a', axis: 'x', at: (p) => [p.a, FUNKTIONEN[p.f].f(p.a)], set: (x) => ({ a: x }) }],
    },
  ],
  layout: { main: ['f', 'a', 'zoom'] },
  anzeige: ['steigung', 'abstand', 'relativ'],
})
