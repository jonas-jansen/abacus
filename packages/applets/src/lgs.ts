// Anhang, lineare Gleichungssysteme mit zwei Unbekannten: each equation a·x₁ + b·x₂ = c is a
// line; the solutions are the common points. Exactly one if the lines cross (det A ≠ 0), none
// if they are parallel, infinitely many if they are the same line.

import { closedForm, category, MAX_ZOOM_OUT, real, quantity, type Series } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const EPS = 1e-9
const R = 6 // plot range ±R
const coef = (label: string, latex: string, def: number) => real(label, { latex, min: -4, max: 4, step: 0.1, default: def })

type P = { a11: number; a12: number; b1: number; a21: number; a22: number; b2: number }

/** The segment of a·x + b·y = c inside the square ±L (empty if a = b = 0); long enough for zooming out. */
function segment(a: number, b: number, c: number, L = MAX_ZOOM_OUT * 2 * R): { x: Float64Array; y: Float64Array } {
  const n = Math.hypot(a, b)
  if (n < EPS) return { x: new Float64Array(), y: new Float64Array() }
  // foot of the perpendicular from the origin, and the direction of the line
  const [px, py] = [(a * c) / (n * n), (b * c) / (n * n)]
  const [dx, dy] = [-b / n, a / n]
  return { x: Float64Array.of(px - L * dx, px + L * dx), y: Float64Array.of(py - L * dy, py + L * dy) }
}

/**
 * The two handles of a line: 2.5 units to either side of the point closest to the origin —
 * away from the middle, where the lines usually cross. The first shifts, the second turns.
 */
function griffe(a: number, b: number, c: number): [[number, number], [number, number]] | null {
  const n = Math.hypot(a, b)
  if (n < EPS) return null
  const [fx, fy] = [(a * c) / (n * n), (b * c) / (n * n)]
  const [dx, dy] = [(-2.5 * b) / n, (2.5 * a) / n]
  return [
    [fx - dx, fy - dy],
    [fx + dx, fy + dy],
  ]
}

/** Line through `fix` and (x, y), written with a normal vector of the same length as before. */
function drehe(a: number, b: number, fix: [number, number], x: number, y: number) {
  const n = Math.hypot(a, b) || 1
  const [dx, dy] = [x - fix[0], y - fix[1]]
  const m = Math.hypot(dx, dy)
  if (m < 1e-6) return null
  const [na, nb] = [(dy / m) * n, (-dx / m) * n]
  return [na, nb, na * fix[0] + nb * fix[1]] as const
}

function loesung(p: P): { art: 'eine' | 'keine' | 'unendlich'; x?: [number, number] } {
  const det = p.a11 * p.a22 - p.a12 * p.a21
  if (Math.abs(det) > EPS) return { art: 'eine', x: [(p.b1 * p.a22 - p.a12 * p.b2) / det, (p.a11 * p.b2 - p.b1 * p.a21) / det] }
  // parallel: the same line iff the augmented rows are proportional too
  const r1 = p.a11 * p.b2 - p.a21 * p.b1
  const r2 = p.a12 * p.b2 - p.a22 * p.b1
  return Math.abs(r1) < EPS && Math.abs(r2) < EPS ? { art: 'unendlich' } : { art: 'keine' }
}

const model = closedForm({
  id: 'lgs',
  params: {
    a11: coef('Zeile 1, x₁', 'a_{11}', 1),
    a12: coef('Zeile 1, x₂', 'a_{12}', -2),
    b1: coef('Zeile 1, rechts', 'b_1', 1),
    a21: coef('Zeile 2, x₁', 'a_{21}', 2),
    a22: coef('Zeile 2, x₂', 'a_{22}', 1),
    b2: real('Zeile 2, rechts', { latex: 'b_2', min: -10, max: 10, step: 0.1, default: 7 }),
  },
  domain: [0, 1],
  curves: {},
  extraSeries: ({ p }) => {
    const l = loesung(p)
    const out: Series[] = [
      { id: 'g1', label: 'g_1', kind: 'continuous', ...segment(p.a11, p.a12, p.b1), role: 'primary' },
      { id: 'g2', label: 'g_2', kind: 'continuous', ...segment(p.a21, p.a22, p.b2), role: 'secondary' },
    ]
    const x = l.x ?? [NaN, NaN]
    out.push(
      { id: 'x1', label: 'x_1', kind: 'discrete', x: Float64Array.of(0), y: Float64Array.of(x[0]), role: 'tertiary' },
      { id: 'x2', label: 'x_2', kind: 'discrete', x: Float64Array.of(0), y: Float64Array.of(x[1]), role: 'tertiary' },
    )
    return out
  },
  observables: ({ p }) => {
    const l = loesung(p)
    const det = p.a11 * p.a22 - p.a12 * p.a21
    const fmt = (v: number) => (Math.round(v * 1000) / 1000).toString().replace('-', '−')
    return {
      det: quantity('Determinante $\\det A$', det),
      art: category('Lösungen', l.art === 'eine' ? 'genau eine' : l.art === 'keine' ? 'keine (parallel)' : 'unendlich viele (dieselbe Gerade)'),
      loesung: category('Lösung $(x_1, x_2)$', l.x ? `(${fmt(l.x[0])}, ${fmt(l.x[1])})` : null, {
        note: l.art === 'keine' ? 'die Geraden schneiden sich nicht' : 'jeder Punkt der Geraden',
        marks: l.x ? [{ kind: 'point', x: l.x[0], y: l.x[1], in: 'phase' }] : [],
      }),
    }
  },
})

const handles = (row: 1 | 2) => {
  const k = (p: P) => (row === 1 ? [p.a11, p.a12, p.b1] : [p.a21, p.a22, p.b2]) as [number, number, number]
  const ids = row === 1 ? (['a11', 'a12', 'b1'] as const) : (['a21', 'a22', 'b2'] as const)
  return [
    // shift the line (only the right-hand side changes)
    {
      param: ids[2],
      axis: 'xy' as const,
      label: `g_${row}`,
      at: (p: P) => griffe(...k(p))?.[0] ?? null,
      set: (x: number, y: number, p: P) => ({ [ids[2]]: k(p)[0] * x + k(p)[1] * y }),
    },
    // turn it around the first handle
    {
      param: ids[0],
      also: [ids[1], ids[2]],
      label: '\\circlearrowleft',
      axis: 'xy' as const,
      at: (p: P) => griffe(...k(p))?.[1] ?? null,
      set: (x: number, y: number, p: P) => {
        const [a, b, c] = k(p)
        const fix = griffe(a, b, c)?.[0]
        const r = fix && drehe(a, b, fix, x, y)
        return r ? { [ids[0]]: r[0], [ids[1]]: r[1], [ids[2]]: r[2] } : {}
      },
    },
  ]
}

export default defineApplet({
  id: 'lgs',
  model,
  formulas: [
    { label: 'System', tex: String.raw`{{a11}}{{*}}x_1 {{+a12}}{{*}}x_2 = {{b1}} \\ {{a21}}{{*}}x_1 {{+a22}}{{*}}x_2 = {{b2}}` },
    { label: 'Determinante', tex: String.raw`\det A = {{a11}}{{*}}{{(a22)}} - {{a12}}{{*}}{{(a21)}}` },
  ],
  plots: [
    {
      type: 'phasePlane',
      xSeries: 'x1',
      ySeries: 'x2',
      overlay: ['g1', 'g2'],
      xLabel: 'x_1',
      yLabel: 'x_2',
      x: [-R, R],
      y: [-R, R],
      drag: [...handles(1), ...handles(2)],
    },
  ],
  layout: { main: ['a11', 'a12', 'b1', 'a21', 'a22', 'b2'] },
  readouts: ['art', 'loesung', 'det'],
})
