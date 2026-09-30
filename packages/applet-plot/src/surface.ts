/**
 * The Surface interface (§5.3): the data layer draws geometry through this, never through
 * CanvasRenderingContext2D directly. Two emitters, same geometry code:
 * `CanvasSurface` for the screen, `SvgPathSurface` for SSR first paint, print and export.
 *
 * Rule: Surface draws geometry only. All text lives in the SVG layers.
 */

import type { SeriesRole } from '@abacus/applet-core'
import { colorVar, roleStyles, type Marker } from './palette'
import type { SvgNode } from './svg'

export interface StrokeStyle {
  role: SeriesRole
  width?: number
  dash?: readonly number[]
  marker?: Marker
  alpha?: number
}

export interface Surface {
  begin(style: StrokeStyle): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  /** A marker in the style's shape (circle by default). */
  dot(x: number, y: number, r: number): void
  /** Filled polygon; pts = [x0, y0, x1, y1, …]. */
  polygon(pts: Float64Array): void
  end(): void
  /** Multiplies the opacity of everything drawn from now on (1 = normal). */
  fade(factor: number): void
  /**
   * An image of cols × rows cells over the rectangle (x, y, w, h), row 0 at the top. Values
   * 0…1 run from the background through the primary to the secondary colour; NaN is empty.
   */
  raster(x: number, y: number, w: number, h: number, cols: number, rows: number, values: Float32Array): void
}

/** The colour scale of rasters: stops at 0, ½ and 1 as [r, g, b]. */
export function rasterColor(v: number, stops: readonly (readonly [number, number, number])[]): [number, number, number] {
  const t = Math.max(0, Math.min(1, v)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(t))
  const f = t - i
  const [a, b] = [stops[i], stops[i + 1]]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

type Resolved = Required<StrokeStyle>

function resolveStyle(s: StrokeStyle): Resolved {
  const d = roleStyles[s.role]
  return {
    role: s.role,
    width: s.width ?? d.width,
    dash: s.dash ?? d.dash,
    marker: s.marker ?? (d.marker === 'none' ? 'circle' : d.marker),
    alpha: s.alpha ?? d.alpha,
  }
}

// Far-off-screen coordinates (divergent series) break both backends; clamp them.
const LIMIT = 1e5
const c = (v: number) => (v > LIMIT ? LIMIT : v < -LIMIT ? -LIMIT : v)

interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  circle(x: number, y: number, r: number): void
  close(): void
}

function markerPath(sink: PathSink, marker: Marker, x: number, y: number, r: number) {
  switch (marker) {
    case 'square': {
      const s = r * 0.9
      sink.moveTo(x - s, y - s)
      sink.lineTo(x + s, y - s)
      sink.lineTo(x + s, y + s)
      sink.lineTo(x - s, y + s)
      sink.close()
      return
    }
    case 'triangle': {
      const s = r * 1.25
      sink.moveTo(x, y - s)
      sink.lineTo(x + s * 0.87, y + s * 0.5)
      sink.lineTo(x - s * 0.87, y + s * 0.5)
      sink.close()
      return
    }
    case 'diamond': {
      const s = r * 1.2
      sink.moveTo(x, y - s)
      sink.lineTo(x + s, y)
      sink.lineTo(x, y + s)
      sink.lineTo(x - s, y)
      sink.close()
      return
    }
    default:
      sink.circle(x, y, r)
  }
}

export class CanvasSurface implements Surface {
  private style: Resolved = resolveStyle({ role: 'primary' })
  private factor = 1
  private dots: number[] = []
  private polys: Float64Array[] = []

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly color: (role: SeriesRole) => string,
    /** The page colour behind the plot: where a raster starts. */
    private readonly background = '#ffffff',
  ) {}

  /** Colours as [r, g, b], parsed once through a 1×1 canvas (any CSS colour works). */
  private rgb(css: string): [number, number, number] {
    const cached = this.rgbCache.get(css)
    if (cached) return cached
    const c = document.createElement('canvas')
    c.width = c.height = 1
    const x = c.getContext('2d')!
    x.fillStyle = css
    x.fillRect(0, 0, 1, 1)
    const d = x.getImageData(0, 0, 1, 1).data
    const out: [number, number, number] = [d[0], d[1], d[2]]
    this.rgbCache.set(css, out)
    return out
  }
  private rgbCache = new Map<string, [number, number, number]>()
  raster(x: number, y: number, w: number, h: number, cols: number, rows: number, values: Float32Array) {
    if (cols < 1 || rows < 1) return
    const stops = [this.rgb(this.background), this.rgb(this.color('primary')), this.rgb(this.color('secondary'))]
    const off = document.createElement('canvas')
    off.width = cols
    off.height = rows
    const octx = off.getContext('2d')!
    const img = octx.createImageData(cols, rows)
    for (let k = 0; k < cols * rows; k++) {
      const v = values[k]
      if (Number.isNaN(v)) continue
      const [r, g, b] = rasterColor(v, stops)
      img.data[4 * k] = r
      img.data[4 * k + 1] = g
      img.data[4 * k + 2] = b
      img.data[4 * k + 3] = Math.round(255 * this.factor)
    }
    octx.putImageData(img, 0, 0)
    const { ctx } = this
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(off, x, y, w, h)
    ctx.restore()
  }
  fade(factor: number) {
    this.factor = factor
  }
  begin(style: StrokeStyle) {
    this.style = resolveStyle(style)
    this.dots = []
    this.polys = []
    this.ctx.beginPath()
  }
  moveTo(x: number, y: number) {
    this.ctx.moveTo(c(x), c(y))
  }
  lineTo(x: number, y: number) {
    this.ctx.lineTo(c(x), c(y))
  }
  dot(x: number, y: number, r: number) {
    this.dots.push(x, y, r)
  }
  polygon(pts: Float64Array) {
    this.polys.push(pts)
  }
  end() {
    const { ctx, style } = this
    const col = this.color(style.role)
    ctx.save()
    ctx.globalAlpha = style.alpha * this.factor
    ctx.strokeStyle = col
    ctx.fillStyle = col
    ctx.lineWidth = style.width
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash(style.dash as number[])
    ctx.stroke()
    if (this.polys.length) {
      ctx.beginPath()
      for (const pts of this.polys) {
        for (let i = 0; i < pts.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, c(pts[i]), c(pts[i + 1]))
        ctx.closePath()
      }
      ctx.fill()
    }
    if (this.dots.length) {
      ctx.beginPath()
      const sink: PathSink = {
        moveTo: (x, y) => ctx.moveTo(x, y),
        lineTo: (x, y) => ctx.lineTo(x, y),
        circle: (x, y, r) => {
          ctx.moveTo(x + r, y)
          ctx.arc(x, y, r, 0, 2 * Math.PI)
        },
        close: () => ctx.closePath(),
      }
      for (let i = 0; i < this.dots.length; i += 3) {
        const x = this.dots[i], y = this.dots[i + 1]
        if (Math.abs(x) < LIMIT && Math.abs(y) < LIMIT) markerPath(sink, style.marker, x, y, this.dots[i + 2])
      }
      ctx.fill()
    }
    ctx.restore()
  }
}

const r1 = (v: number) => Math.round(c(v) * 10) / 10

export class SvgPathSurface implements Surface {
  readonly nodes: SvgNode[] = []
  private style: Resolved = resolveStyle({ role: 'primary' })
  private factor = 1
  raster(x: number, y: number, w: number, h: number, cols: number, rows: number, values: Float32Array) {
    // first paint only: the cells in eight shades, one path each
    const LEVELS = 8
    const paths: string[][] = Array.from({ length: LEVELS }, () => [])
    const [cw, ch] = [w / cols, h / rows]
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const v = values[r * cols + q]
        if (Number.isNaN(v)) continue
        const lvl = Math.min(LEVELS - 1, Math.floor(v * LEVELS))
        if (lvl === 0) continue // the lowest shade is the background itself
        paths[lvl].push(`M${r1(x + q * cw)} ${r1(y + r * ch)}h${r1(cw + 0.3)}v${r1(ch + 0.3)}h${r1(-cw - 0.3)}Z`)
      }
    }
    paths.forEach((d, lvl) => {
      if (!d.length) return
      const t = (lvl + 0.5) / LEVELS
      const fill = t < 0.5 ? `color-mix(in srgb, var(--abacus-primary) ${Math.round(t * 200)}%, var(--ab-bg))` : `color-mix(in srgb, var(--abacus-secondary) ${Math.round((t - 0.5) * 200)}%, var(--abacus-primary))`
      this.nodes.push({ tag: 'path', attrs: { d: d.join(''), style: `fill: ${fill}` } })
    })
  }
  fade(factor: number) {
    this.factor = factor
  }
  private d: string[] = []
  private fillD: string[] = []

  begin(style: StrokeStyle) {
    this.style = resolveStyle(style)
    this.d = []
    this.fillD = []
  }
  moveTo(x: number, y: number) {
    this.d.push(`M${r1(x)} ${r1(y)}`)
  }
  lineTo(x: number, y: number) {
    this.d.push(`L${r1(x)} ${r1(y)}`)
  }
  dot(x: number, y: number, r: number) {
    if (Math.abs(x) >= LIMIT || Math.abs(y) >= LIMIT) return
    const out = this.fillD
    markerPath(
      {
        moveTo: (x, y) => out.push(`M${r1(x)} ${r1(y)}`),
        lineTo: (x, y) => out.push(`L${r1(x)} ${r1(y)}`),
        circle: (x, y, r) => out.push(`M${r1(x + r)} ${r1(y)}A${r} ${r} 0 1 0 ${r1(x - r)} ${r1(y)}A${r} ${r} 0 1 0 ${r1(x + r)} ${r1(y)}Z`),
        close: () => out.push('Z'),
      },
      this.style.marker,
      x,
      y,
      r,
    )
  }
  polygon(pts: Float64Array) {
    for (let i = 0; i < pts.length; i += 2) this.fillD.push(`${i ? 'L' : 'M'}${r1(pts[i])} ${r1(pts[i + 1])}`)
    this.fillD.push('Z')
  }
  end() {
    const { style } = this
    const color = `var(${colorVar(style.role)})`
    const opacity = style.alpha * this.factor === 1 ? undefined : style.alpha * this.factor
    if (this.d.length) {
      this.nodes.push({
        tag: 'path',
        attrs: {
          d: this.d.join(''),
          fill: 'none',
          stroke: color,
          'stroke-width': style.width,
          'stroke-dasharray': style.dash.length ? style.dash.join(' ') : undefined,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
          opacity,
        },
      })
    }
    if (this.fillD.length) this.nodes.push({ tag: 'path', attrs: { d: this.fillD.join(''), fill: color, opacity } })
  }
}
