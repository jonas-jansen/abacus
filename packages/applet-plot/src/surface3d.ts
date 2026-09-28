/**
 * Surface3D (§5.4): z = f(x, y) on a grid, orthographic projection, painter's algorithm,
 * Lambert shading. Pure geometry: `scene3d` returns sorted primitives and SVG labels; the UI
 * paints them on a canvas, the server as SVG.
 *
 * With a reference (`grid.ref`) the surface is coloured by the sign of z − ref — warm where
 * z > ref, cool where z < ref — and the curve z = ref is drawn: for an update map that is
 * where a quantity grows, where it shrinks, and where it stays put.
 */

import { decimalsOf, formatFixed, niceTicks, type Grid } from '@abacus/applet-core'
import { mathText } from './mathText'
import type { SvgNode } from './svg'

export interface View3D {
  /** Rotation about the vertical axis, radians. */
  az: number
  /** Elevation of the eye above the floor, radians (0 = side view). */
  el: number
}

export const DEFAULT_VIEW: View3D = { az: -0.65, el: 0.55 }

export type Stroke = 'contour' | 'marker' | 'axis'

export type Item =
  | { kind: 'poly'; pts: number[]; fill: string }
  | { kind: 'line'; pts: number[]; stroke: Stroke; width: number }

export interface Scene3D {
  /** Back to front. */
  items: Item[]
  /** Floor grid and box edges, drawn first: [x1, y1, x2, y2, …]. */
  floor: number[]
  labels: SvgNode
  /** The marked point on the surface and its foot on the floor, in pixels. */
  marker: { x: number; y: number; fx: number; fy: number } | null
  /** The data point (x, y) on the floor under the pixel (px, py): for dragging on the floor. */
  floorAt: (px: number, py: number) => [number, number]
}

const Z_HALF = 0.72

function range(v: ArrayLike<number>): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < v.length; i++) {
    if (!Number.isFinite(v[i])) continue
    if (v[i] < lo) lo = v[i]
    if (v[i] > hi) hi = v[i]
  }
  if (!(hi > lo)) return lo === Infinity ? [0, 1] : [lo - 1, hi + 1]
  return [lo, hi]
}

/** Warm/cool (with a reference) or a blue→orange height ramp, shaded by `light` ∈ [0, 1]. */
function colour(t: number, sign: number | null, light: number): string {
  const l = Math.round(34 + 34 * light)
  if (sign !== null) return sign > 0 ? `hsl(24 86% ${l}%)` : `hsl(218 78% ${l}%)`
  return `hsl(${Math.round(218 - 194 * t)} 72% ${l}%)`
}

export interface Scene3DInput {
  grid: Grid
  width: number
  height: number
  view: View3D
  labels?: { x?: string; y?: string; z?: string }
  fontSize?: number
}

export function scene3d({ grid, width, height, view, labels = {}, fontSize = 12 }: Scene3DInput): Scene3D {
  const nx = grid.x.length
  const ny = grid.y.length
  const [x0, x1] = [grid.x[0], grid.x[nx - 1]]
  const [y0, y1] = [grid.y[0], grid.y[ny - 1]]
  const zr = range(grid.z)
  const [z0, z1] = zr

  // data → normalised cube [-1, 1]² × [-Z_HALF, Z_HALF]
  const NX = (x: number) => -1 + (2 * (x - x0)) / (x1 - x0)
  const NY = (y: number) => -1 + (2 * (y - y0)) / (y1 - y0)
  const NZ = (z: number) => -Z_HALF + (2 * Z_HALF * (z - z0)) / (z1 - z0)

  const ca = Math.cos(view.az)
  const sa = Math.sin(view.az)
  const ce = Math.cos(view.el)
  const se = Math.sin(view.el)
  // view coordinates: u right, v up, d away from the eye
  const toView = (x: number, y: number, z: number) => {
    const xr = x * ca - y * sa
    const yr = x * sa + y * ca
    return { u: xr, v: z * ce + yr * se, d: yr * ce - z * se }
  }

  // fit the box into the figure, leaving room for labels
  const pad = fontSize * 3.2
  let umin = Infinity
  let umax = -Infinity
  let vmin = Infinity
  let vmax = -Infinity
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-Z_HALF, Z_HALF]) {
        const p = toView(x, y, z)
        umin = Math.min(umin, p.u)
        umax = Math.max(umax, p.u)
        vmin = Math.min(vmin, p.v)
        vmax = Math.max(vmax, p.v)
      }
    }
  }
  const scale = Math.min((width - 2 * pad) / (umax - umin), (height - 2 * pad) / (vmax - vmin))
  const cx = width / 2 - (scale * (umin + umax)) / 2
  const cy = height / 2 + (scale * (vmin + vmax)) / 2
  const screen = (x: number, y: number, z: number) => {
    const p = toView(x, y, z)
    return { x: cx + scale * p.u, y: cy - scale * p.v, d: p.d }
  }

  // light from the upper left, towards the viewer (view coordinates)
  const L = [-0.45, 0.75, -0.5]
  const Ln = Math.hypot(L[0], L[1], L[2])

  type Sorted = Item & { depth: number }
  const items: Sorted[] = []
  const Z = (i: number, j: number) => grid.z[j * nx + i]
  const R = (i: number, j: number) => (grid.ref ? grid.ref[j * nx + i] : 0)

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const zs = [Z(i, j), Z(i + 1, j), Z(i + 1, j + 1), Z(i, j + 1)]
      if (!zs.every(Number.isFinite)) continue
      const xs = [grid.x[i], grid.x[i + 1], grid.x[i + 1], grid.x[i]]
      const ys = [grid.y[j], grid.y[j], grid.y[j + 1], grid.y[j + 1]]
      const P = zs.map((z, k) => screen(NX(xs[k]), NY(ys[k]), NZ(z)))
      // normal from the diagonals, in view coordinates
      const a = toView(NX(xs[2]) - NX(xs[0]), NY(ys[2]) - NY(ys[0]), NZ(zs[2]) - NZ(zs[0]))
      const b = toView(NX(xs[3]) - NX(xs[1]), NY(ys[3]) - NY(ys[1]), NZ(zs[3]) - NZ(zs[1]))
      const n = [a.v * b.d - a.d * b.v, a.d * b.u - a.u * b.d, a.u * b.v - a.v * b.u]
      const nn = Math.hypot(n[0], n[1], n[2]) || 1
      const light = Math.abs((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nn * Ln))
      const zc = (zs[0] + zs[1] + zs[2] + zs[3]) / 4
      const sign = grid.ref ? Math.sign(zc - (R(i, j) + R(i + 1, j) + R(i + 1, j + 1) + R(i, j + 1)) / 4) : null
      items.push({
        kind: 'poly',
        pts: P.flatMap((p) => [p.x, p.y]),
        fill: colour((zc - z0) / (z1 - z0), sign, light),
        depth: (P[0].d + P[1].d + P[2].d + P[3].d) / 4,
      })
    }
  }

  // The curve z = ref, by marching squares on z − ref.
  if (grid.ref) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const corners: [number, number][] = [
          [i, j],
          [i + 1, j],
          [i + 1, j + 1],
          [i, j + 1],
        ]
        const d = corners.map(([a, b]) => Z(a, b) - R(a, b))
        if (!d.every(Number.isFinite)) continue
        const cuts: { x: number; y: number; z: number }[] = []
        for (let k = 0; k < 4; k++) {
          const [a, b] = [k, (k + 1) % 4]
          if (d[a] === 0 || Math.sign(d[a]) === Math.sign(d[b])) continue
          const s = d[a] / (d[a] - d[b])
          const [ia, ja] = corners[a]
          const [ib, jb] = corners[b]
          cuts.push({
            x: grid.x[ia] + s * (grid.x[ib] - grid.x[ia]),
            y: grid.y[ja] + s * (grid.y[jb] - grid.y[ja]),
            z: Z(ia, ja) + s * (Z(ib, jb) - Z(ia, ja)),
          })
        }
        for (let k = 0; k + 1 < cuts.length; k += 2) {
          const p = screen(NX(cuts[k].x), NY(cuts[k].y), NZ(cuts[k].z))
          const q = screen(NX(cuts[k + 1].x), NY(cuts[k + 1].y), NZ(cuts[k + 1].z))
          // a hair in front of the cells it lies on
          items.push({ kind: 'line', pts: [p.x, p.y, q.x, q.y], stroke: 'contour', width: 2.5, depth: (p.d + q.d) / 2 - 0.02 })
        }
      }
    }
  }
  items.sort((p, q) => q.depth - p.depth)

  // Floor: box outline and grid at the lowest z.
  const floor: number[] = []
  const zf = -Z_HALF
  const seg = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
    const p = screen(ax, ay, az)
    const q = screen(bx, by, bz)
    floor.push(p.x, p.y, q.x, q.y)
  }
  const xt = niceTicks(x0, x1, 4)
  const yt = niceTicks(y0, y1, 4)
  const zt = niceTicks(z0, z1, 4)
  for (const t of xt.ticks) seg(NX(t), -1, zf, NX(t), 1, zf)
  for (const t of yt.ticks) seg(-1, NY(t), zf, 1, NY(t), zf)
  seg(-1, -1, zf, 1, -1, zf)
  seg(1, -1, zf, 1, 1, zf)
  seg(1, 1, zf, -1, 1, zf)
  seg(-1, 1, zf, -1, -1, zf)

  // Labels on the floor edges nearest the viewer; z on the leftmost corner.
  const nodes: SvgNode[] = []
  const text = (x: number, y: number, s: string, anchor: string) =>
    nodes.push({ tag: 'text', attrs: { x, y, 'text-anchor': anchor, 'dominant-baseline': 'central', class: 'abacus-tick' }, text: s })
  const nearer = (a: number, b: number, along: 'x' | 'y') =>
    along === 'x' ? (screen(0, a, zf).d < screen(0, b, zf).d ? a : b) : screen(a, 0, zf).d < screen(b, 0, zf).d ? a : b
  const yEdge = nearer(-1, 1, 'x') // x axis runs along y = yEdge
  const xEdge = nearer(-1, 1, 'y') // y axis runs along x = xEdge
  const out = (p: { x: number; y: number }, from: { x: number; y: number }, k: number) => {
    const dx = p.x - from.x
    const dy = p.y - from.y
    const m = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / m) * k, y: p.y + (dy / m) * k }
  }
  const centre = screen(0, 0, zf)
  const anchorFor = (x: number) => (x < centre.x - 4 ? 'end' : x > centre.x + 4 ? 'start' : 'middle')
  const dx = decimalsOf(xt.step)
  for (const t of xt.ticks) {
    const p = out(screen(NX(t), yEdge, zf), screen(NX(t), 0, zf), fontSize * 0.9)
    text(p.x, p.y, formatFixed(t, dx), anchorFor(p.x))
  }
  const dy = decimalsOf(yt.step)
  for (const t of yt.ticks) {
    if (Math.abs(NY(t) - yEdge) < 1e-9) continue // the corner is labelled by the x axis
    const p = out(screen(xEdge, NY(t), zf), screen(0, NY(t), zf), fontSize * 0.9)
    text(p.x, p.y, formatFixed(t, dy), anchorFor(p.x))
  }
  const axisLabel = (tex: string | undefined, p: { x: number; y: number }) => {
    if (tex) nodes.push(mathText(tex, { x: p.x, y: p.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'abacus-axis-label' }))
  }
  axisLabel(labels.x, out(screen(0, yEdge, zf), screen(0, 0, zf), fontSize * 2.6))
  axisLabel(labels.y, out(screen(xEdge, 0, zf), screen(0, 0, zf), fontSize * 2.6))

  // vertical z axis at the floor corner furthest left on screen
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => ({ a, b, s: screen(a, b, zf) }))
  const zc = corners.reduce((m, c) => (c.s.x < m.s.x ? c : m))
  seg(zc.a, zc.b, -Z_HALF, zc.a, zc.b, Z_HALF)
  const dz = decimalsOf(zt.step)
  for (const t of zt.ticks) {
    const p = screen(zc.a, zc.b, NZ(t))
    floor.push(p.x - 4, p.y, p.x, p.y)
    text(p.x - 7, p.y, formatFixed(t, dz), 'end')
  }
  const top = screen(zc.a, zc.b, Z_HALF)
  axisLabel(labels.z, { x: top.x, y: top.y - fontSize * 1.4 })

  let marker: Scene3D['marker'] = null
  if (grid.marker) {
    const [mx, my] = grid.marker
    if (mx >= x0 && mx <= x1 && my >= y0 && my <= y1) {
      const mz = bilinear(grid, mx, my)
      if (Number.isFinite(mz)) {
        const p = screen(NX(mx), NY(my), NZ(mz))
        const f = screen(NX(mx), NY(my), zf)
        marker = { x: p.x, y: p.y, fx: f.x, fy: f.y }
      }
    }
  }

  const floorAt = (px: number, py: number): [number, number] => {
    // invert the (affine) projection of the plane z = zf
    const u = (px - cx) / scale
    const q = ((cy - py) / scale - zf * ce) / (se || 1e-6)
    const xn = u * ca + q * sa
    const yn = -u * sa + q * ca
    return [x0 + ((xn + 1) / 2) * (x1 - x0), y0 + ((yn + 1) / 2) * (y1 - y0)]
  }

  return {
    floorAt,
    items: items.map(({ depth: _d, ...it }) => it as Item),
    floor,
    labels: { tag: 'g', attrs: { 'font-size': fontSize }, children: nodes },
    marker,
  }
}

/** z at (x, y) by bilinear interpolation on the grid. */
export function bilinear(grid: Grid, x: number, y: number): number {
  const nx = grid.x.length
  const ny = grid.y.length
  const fi = ((x - grid.x[0]) / (grid.x[nx - 1] - grid.x[0])) * (nx - 1)
  const fj = ((y - grid.y[0]) / (grid.y[ny - 1] - grid.y[0])) * (ny - 1)
  const i = Math.min(nx - 2, Math.max(0, Math.floor(fi)))
  const j = Math.min(ny - 2, Math.max(0, Math.floor(fj)))
  const s = fi - i
  const t = fj - j
  const z = (a: number, b: number) => grid.z[b * nx + a]
  return (1 - s) * (1 - t) * z(i, j) + s * (1 - t) * z(i + 1, j) + (1 - s) * t * z(i, j + 1) + s * t * z(i + 1, j + 1)
}

/** The scene as SVG nodes (server render, thumbnails). */
export function sceneSvg(scene: Scene3D): SvgNode[] {
  const nodes: SvgNode[] = []
  const d: string[] = []
  for (let k = 0; k < scene.floor.length; k += 4) {
    const [a, b, c, e] = scene.floor.slice(k, k + 4).map((v) => Math.round(v * 10) / 10)
    d.push(`M${a} ${b}L${c} ${e}`)
  }
  nodes.push({ tag: 'path', attrs: { d: d.join(''), class: 'abacus-axis', fill: 'none' } })
  const r = (v: number) => Math.round(v * 10) / 10
  for (const it of scene.items) {
    if (it.kind === 'poly') {
      const pts = []
      for (let k = 0; k < it.pts.length; k += 2) pts.push(`${r(it.pts[k])},${r(it.pts[k + 1])}`)
      nodes.push({ tag: 'polygon', attrs: { points: pts.join(' '), fill: it.fill, stroke: it.fill, 'stroke-width': 0.6 } })
    } else {
      nodes.push({
        tag: 'line',
        attrs: { x1: r(it.pts[0]), y1: r(it.pts[1]), x2: r(it.pts[2]), y2: r(it.pts[3]), class: `ab3d-${it.stroke}`, 'stroke-width': it.width },
      })
    }
  }
  return nodes
}
