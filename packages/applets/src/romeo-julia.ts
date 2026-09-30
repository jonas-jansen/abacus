// MATLAB: app_RJ — Romeo and Julia: the planar linear system again, read as a love story.
// R' = a₁₁ R + a₁₂ J, J' = a₂₁ R + a₂₂ J. The signs say who reacts how: a₁₂ > 0 — Romeo loves
// more the more Julia loves him; a₂₁ < 0 — Julia backs off when Romeo gets keen.

import { classify, eigenReadout, klasse, ode, ORIGIN, point, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const entry = (label: string, latex: string, def: number) => real(label, { latex, min: -1, max: 1, step: 0.01, default: def })

const STORY: Record<string, string> = {
  Zentrum: 'ewiger Kreislauf',
  'stabiler Strudel': 'Auf und Ab, das abklingt',
  'instabiler Strudel': 'immer heftigeres Auf und Ab',
  'stabiler Knoten': 'Gleichgültigkeit stellt sich ein',
  'instabiler Knoten': 'die Gefühle schaukeln sich auf',
  Sattel: 'hängt vom Anfang ab: Liebe oder Hass',
  entartet: 'ein Grenzfall',
}

const model = ode({
  id: 'romeo-julia',
  params: {
    a: entry('Romeo über sich', 'a_{11}', 0),
    b: entry('Romeo über Julia', 'a_{12}', 0.25),
    c: entry('Julia über Romeo', 'a_{21}', -0.5),
    d: entry('Julia über sich', 'a_{22}', 0),
    start: point('Anfang', { latex: '(R_0, J_0)', xBounds: [-1, 1], yBounds: [-1, 1], default: [1, 0] }),
    T: real('Zeitfenster', { latex: 'T', min: 1, max: 80, step: 1, default: 36, limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  components: [
    { id: 'R', label: 'R(t)', name: 'Romeos Gefühle', role: 'primary' },
    { id: 'J', label: 'J(t)', name: 'Julias Gefühle', role: 'secondary' },
  ],
  start: (p) => p.start,
  rhs: (_t, y, p) => [p.a * y[0] + p.b * y[1], p.c * y[0] + p.d * y[1]],
  tEnd: (p) => p.T,
  samples: 800,
  observables: ({ p }) => {
    const tr = p.a + p.d
    const det = p.a * p.d - p.b * p.c
    const typ = classify(tr, det)
    return {
      eigenwerte: eigenReadout(p.a, p.b, p.c, p.d),
      typ: klasse('Typ', typ, { marks: [ORIGIN] }),
      geschichte: klasse('Die Geschichte', STORY[typ] ?? null),
      spur: zahl('Spur', tr),
    }
  },
})

export default defineApplet({
  id: 'romeo-julia',
  titel: 'Romeo und Julia',
  kurz: 'Zwei Gefühle, die aufeinander reagieren – ein lineares System als Liebesgeschichte.',
  kapitel: 'IV',
  folien: '11–21',
  model,
  horizont: 'T',
  formeln: [
    { label: 'System', tex: String.raw`R' = {{a}}{{*}}R {{+b}}{{*}}J \\ J' = {{c}}{{*}}R {{+d}}{{*}}J` },
    { label: 'Start', tex: String.raw`(R, J)(0) = {{#start}}` },
  ],
  plots: [
    { type: 'timeSeriesContinuous', xLabel: 't', yLabel: 'R, J', y: [-2, 2] },
    { type: 'phasePlane', xSeries: 'R', ySeries: 'J', xLabel: 'R', yLabel: 'J', x: [-2, 2], y: [-2, 2], field: true, bahnen: true, nullclines: true, drag: { param: 'start', axis: 'xy' } },
  ],
  layout: { main: ['a', 'b', 'c', 'd'] },
  anzeige: ['typ', 'geschichte', 'eigenwerte'],
})
