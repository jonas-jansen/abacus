import katex from 'katex'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { formatNumber, type ParamSpec, type Params, type Point } from '@abacus/applet-core'
import { expandFormula, formulaLines, splitRelation, type Formel, type FormulaMode } from './formula'

const SCRUB_PX = 5
/** Side by side only while the columns need at most this much shrinking; else they stack. */
const STACK_BELOW = 0.75

interface FormulaBarProps {
  formeln: readonly Formel[]
  specs: readonly ParamSpec[]
  params: Params
  /** Change one parameter (validated and explained like a slider change). */
  onChange: (id: string, value: unknown) => void
  /** Pointing at a parameter in the formula: its slider row and handles light up. */
  onHot: (id: string | null) => void
  /** Click on a parameter: go to its input field. */
  onFocusParam: (id: string) => void
  /** Parameter lit up from elsewhere (slider row or handle). */
  hot?: string | null
}

// display style: full-size fractions, but inline layout (no centred block per formula)
const render = (tex: string) =>
  katex.renderToString(`\\displaystyle ${tex}`, {
    displayMode: false,
    throwOnError: false,
    strict: false,
    // only \htmlData, and only for the attributes this component writes
    trust: (ctx) => ctx.command === '\\htmlData',
  })

/** A round step of about 1/100 of a span: 8 → 0,1; 0,02 → 0,0001. */
const niceStep = (span: number) => 10 ** Math.floor(Math.log10(Math.max(span, 1e-12) / 100))

/** The step a drag or arrow key moves a parameter (or one entry of a point) by. */
function stepOf(spec: ParamSpec | undefined, idx?: number): number | null {
  if (!spec) return null
  if (spec.kind === 'real') return spec.step
  if (spec.kind === 'int') return 1
  if (spec.kind === 'point' && idx !== undefined) {
    const [a, b] = idx === 0 ? spec.xBounds : spec.yBounds
    return niceStep(b - a)
  }
  return null
}

interface Cell {
  key: string
  cls: string
  html: string
  /** Grid placement "column|row", wide (columns side by side) and narrow (stacked). */
  wide: string
  narrow: string
}

/**
 * The model as formulas, with its parameters live: point at a parameter to see it light up
 * in the controls and the plot, drag it sideways to change it, click it to type a value.
 * A switch puts the current values in place of the symbols.
 *
 * Layout: each formula is a column (model, start, solution …) with its title on top. Inside
 * a column the lines align at their relation; lines of different columns share rows, so
 * S′ = … and S(0) = … stand side by side. Narrow boxes stack the columns.
 */
export function FormulaBar({ formeln, specs, params, onChange, onHot, onFocusParam, hot }: FormulaBarProps) {
  const [mode, setMode] = useState<FormulaMode>('symbole')
  const root = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; idx?: number; x: number; v: number; moved: boolean } | null>(null)

  const { cells, columns } = useMemo(() => {
    const tex = (t: string) => (t ? render(expandFormula(t, specs, params, mode)) : '')
    const out: Cell[] = []
    let narrowRow = 1
    const rows = Math.max(1, ...formeln.map((f) => formulaLines(f.tex).length))
    formeln.forEach((f, c) => {
      const col = 4 * c + 1 // three sub-columns per formula, then a gap column
      if (f.label) out.push({ key: `${c}t`, cls: 'ab-eq-title', html: f.label, wide: `${col} / span 3|1`, narrow: `1 / -1|${narrowRow++}` })
      const lines = formulaLines(f.tex)
      lines.forEach((line, i) => {
        const { lhs, rel, rhs } = splitRelation(line)
        // a single vector next to a system of several lines stands centred beside all of them
        const vectorId = /\{\{\s*#\s*([A-Za-z_]\w*)\s*\}\}/.exec(line)?.[1]
        const tall = lines.length === 1 && rows > 1 && specs.some((s) => s.kind === 'point' && s.id === vectorId)
        const wr = tall ? `2 / span ${rows}` : String(i + 2)
        const nr = narrowRow++
        if (!rel) {
          out.push({ key: `${c}.${i}`, cls: 'ab-eq-whole', html: tex(rhs), wide: `${col} / span 3|${wr}`, narrow: `1 / -1|${nr}` })
          return
        }
        const t = tall ? ' ab-eq-tall' : ''
        out.push({ key: `${c}.${i}l`, cls: 'ab-eq-lhs' + t, html: tex(lhs), wide: `${col}|${wr}`, narrow: `1|${nr}` })
        out.push({ key: `${c}.${i}r`, cls: 'ab-eq-rel' + t, html: render(rel), wide: `${col + 1}|${wr}`, narrow: `2|${nr}` })
        out.push({ key: `${c}.${i}s`, cls: 'ab-eq-rhs' + t, html: tex(rhs), wide: `${col + 2}|${wr}`, narrow: `3|${nr}` })
      })
    })
    return { cells: out, columns: formeln.length }
  }, [formeln, specs, params, mode])

  // Fit: formulas wider than the box are set smaller rather than scrolled or cut off.
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    const el = grid.current
    if (!el || !width) return
    el.style.fontSize = ''
    // Columns that would have to shrink a lot stack instead, as on phones.
    el.removeAttribute('data-stacked')
    if (el.scrollWidth > width / STACK_BELOW) el.setAttribute('data-stacked', '')
    // a few passes: KaTeX spacing does not scale exactly linearly
    for (let pass = 0; pass < 3 && el.scrollWidth > width; pass++) {
      const size = parseFloat(getComputedStyle(el).fontSize)
      el.style.fontSize = `${Math.max(9, (size * width) / el.scrollWidth - 0.3)}px`
    }
  }, [cells, width])

  // KaTeX output is plain HTML: make the parameter spans reachable by keyboard and screen readers.
  useEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('[data-param]').forEach((el) => {
      const spec = specs.find((s) => s.id === el.dataset.param)
      if (!spec) return
      const idx = el.dataset.idx === undefined ? undefined : Number(el.dataset.idx)
      const raw = params[spec.id]
      const v = Array.isArray(raw) && idx !== undefined ? raw[idx] : raw
      const name = idx === undefined ? spec.label : `${spec.label}, ${idx + 1}. Eintrag`
      el.tabIndex = 0
      el.setAttribute('role', stepOf(spec, idx) === null ? 'button' : 'slider')
      el.setAttribute('aria-label', name)
      if (typeof v === 'number') el.setAttribute('aria-valuenow', String(v))
      el.title =
        spec.kind === 'bool' || spec.kind === 'choice'
          ? `${spec.label} – klicken zum Umschalten`
          : `${name} = ${typeof v === 'number' ? formatNumber(v, 6) : String(v)} – ziehen zum Ändern, klicken zum Eintippen`
      el.toggleAttribute('data-hot', spec.id === hot)
    })
  })

  const target = (e: { target: EventTarget }) => (e.target as HTMLElement).closest<HTMLElement>('[data-param]')
  const idxOf = (el: HTMLElement | null) => (el?.dataset.idx === undefined ? undefined : Number(el.dataset.idx))
  const specOf = (id: string) => specs.find((s) => s.id === id)
  const valueOf = (id: string, idx?: number) => {
    const v = params[id]
    return Array.isArray(v) && idx !== undefined ? v[idx] : v
  }
  const set = (id: string, idx: number | undefined, v: number) => {
    const cur = params[id]
    if (Array.isArray(cur) && idx !== undefined) {
      const next = [...(cur as Point)] as [number, number]
      next[idx] = v
      onChange(id, next)
    } else onChange(id, v)
  }

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = target(e)
    const id = el?.dataset.param
    if (!id || e.button !== 0) return
    const idx = idxOf(el)
    const v = valueOf(id, idx)
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id, idx, x: e.clientX, v: typeof v === 'number' ? v : NaN, moved: false }
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) {
      if (e.pointerType === 'mouse') onHot(target(e)?.dataset.param ?? null)
      return
    }
    const step = stepOf(specOf(d.id), d.idx)
    const dx = e.clientX - d.x
    if (step === null || !Number.isFinite(d.v) || (!d.moved && Math.abs(dx) < 3)) return
    d.moved = true
    const k = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    set(d.id, d.idx, d.v + Math.round(dx / SCRUB_PX) * step * k)
  }
  // A click: switches flip, choices move to the next option, numbers go to their input field.
  const activate = (id: string) => {
    const spec = specOf(id)
    if (spec?.kind === 'bool') onChange(id, !params[id])
    else if (spec?.kind === 'choice') {
      const i = spec.options.findIndex((o) => o.value === params[id])
      onChange(id, spec.options[(i + 1) % spec.options.length].value)
    } else onFocusParam(id)
  }
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (d && !d.moved) activate(d.id)
  }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = target(e)
    const id = el?.dataset.param
    if (!id) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate(id)
      return
    }
    const idx = idxOf(el)
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    const step = stepOf(specOf(id), idx)
    const v = valueOf(id, idx)
    if (!dir || step === null || typeof v !== 'number') return
    e.preventDefault()
    set(id, idx, v + dir * step * (e.shiftKey ? 10 : 1))
  }

  const values = mode === 'zahlen'
  const wideCols = Array.from({ length: columns }, () => 'auto auto auto').join(' var(--ab-col-gap) ')

  return (
    <div className="ab-model">
      <div
        ref={root}
        className="ab-formulas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => !drag.current && onHot(null)}
        onFocus={(e) => onHot(target(e)?.dataset.param ?? null)}
        onBlur={() => onHot(null)}
        onKeyDown={key}
      >
        <div className="ab-eqs" ref={grid} style={{ '--ab-wide-cols': wideCols } as CSSProperties}>
          {cells.map((c) => {
            const [wc, wr] = c.wide.split('|')
            const [nc, nr] = c.narrow.split('|')
            const style = { '--wc': wc, '--wr': wr, '--nc': nc, '--nr': nr } as CSSProperties
            return c.cls.startsWith('ab-eq-title') ? (
              <span key={c.key} className={c.cls} style={style}>
                {c.html}
              </span>
            ) : (
              <span key={c.key} className={c.cls} style={style} dangerouslySetInnerHTML={{ __html: c.html }} />
            )
          })}
        </div>
      </div>
      <button
        type="button"
        className="ab-values"
        role="switch"
        aria-checked={values}
        onClick={() => setMode(values ? 'symbole' : 'zahlen')}
        title={values ? 'wieder Symbole zeigen' : 'die aktuellen Werte in die Formeln einsetzen'}
      >
        <span className="ab-values-track" aria-hidden="true">
          <span className="ab-values-knob" />
          <span className="ab-values-opt ab-values-sym">a</span>
          <span className="ab-values-opt ab-values-num">1,5</span>
        </span>
        <span className="ab-values-label">Werte einsetzen</span>
      </button>
    </div>
  )
}
