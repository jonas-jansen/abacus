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
  /** Content with symbols and with values; both are laid out, one is shown. */
  sym: string
  num: string
  /** Grid placement "column|row", wide (columns side by side) and narrow (stacked). */
  wide: string
  narrow: string
}

/**
 * The model as formulas, with its parameters live: point at a parameter to see it light up
 * in the controls and the plot, drag it sideways to change it, click it to type a value.
 * The last column switches between symbols and values.
 *
 * Layout: each formula is a column (model, start, solution …) with its title on top. Inside
 * a column the lines align at their relation; lines of different columns share rows, so
 * S′ = … and S(0) = … stand side by side. Every cell holds both versions — symbols and
 * values — on top of each other, so switching never changes a column's width.
 */
export function FormulaBar({ formeln, specs, params, onChange, onHot, onFocusParam, hot }: FormulaBarProps) {
  const [mode, setMode] = useState<FormulaMode>('symbole')
  const root = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; idx?: number; x: number; v: number; moved: boolean } | null>(null)

  const { cells, columns } = useMemo(() => {
    const both = (t: string) =>
      t ? { sym: render(expandFormula(t, specs, params, 'symbole')), num: render(expandFormula(t, specs, params, 'zahlen')) } : { sym: '', num: '' }
    const out: Cell[] = []
    // narrow: the switch comes first (rows 1–2), then the formulas one below the other
    let narrowRow = 3
    const rows = Math.max(1, ...formeln.map((f) => formulaLines(f.tex).length))
    formeln.forEach((f, c) => {
      const col = 4 * c + 1 // three sub-columns per formula, then a gap column
      if (f.label) out.push({ key: `${c}t`, cls: 'ab-eq-title', sym: f.label, num: f.label, wide: `${col} / span 3|1`, narrow: `1 / -1|${narrowRow++}` })
      const lines = formulaLines(f.tex)
      lines.forEach((line, i) => {
        const { lhs, rel, rhs } = splitRelation(line)
        // A start vector next to a system of several lines: its entries get rows of their own,
        // level with the equations, inside brackets drawn across those rows.
        const vectorId = /^\{\{\s*#\s*([A-Za-z_]\w*)\s*\}\}$/.exec(rhs)?.[1]
        if (lines.length === 1 && rows >= 2 && rel && specs.some((s) => s.kind === 'point' && s.id === vectorId)) {
          const nr = narrowRow
          narrowRow += 2
          const span = (col: number, ncol: number) => ({ wide: `${col}|2 / span 2`, narrow: `${ncol}|${nr} / span 2` })
          const r = render(rel)
          out.push({ key: `${c}.vl`, cls: 'ab-eq-lhs ab-eq-tall', ...both(lhs), ...span(col, 1) })
          out.push({ key: `${c}.vr`, cls: 'ab-eq-rel ab-eq-tall', sym: r, num: r, ...span(col + 1, 2) })
          out.push({ key: `${c}.vb`, cls: 'ab-eq-bracket', sym: '', num: '', ...span(col + 2, 3) })
          for (const k of [0, 1]) {
            out.push({ key: `${c}.v${k}`, cls: 'ab-eq-rhs ab-eq-entry', ...both(`{{#${vectorId}.${k}}}`), wide: `${col + 2}|${2 + k}`, narrow: `3|${nr + k}` })
          }
          // stacked, there are no equations beside it: the vector goes back to one compact cell
          out.push({ key: `${c}.vf`, cls: 'ab-eq-rhs ab-eq-vecflat', ...both(rhs), wide: `${col + 2}|2`, narrow: `3|${nr} / span 2` })
          return
        }
        const wr = String(i + 2)
        const nr = narrowRow++
        if (!rel) {
          out.push({ key: `${c}.${i}`, cls: 'ab-eq-whole', ...both(rhs), wide: `${col} / span 3|${wr}`, narrow: `1 / -1|${nr}` })
          return
        }
        const r = render(rel)
        out.push({ key: `${c}.${i}l`, cls: 'ab-eq-lhs', ...both(lhs), wide: `${col}|${wr}`, narrow: `1|${nr}` })
        out.push({ key: `${c}.${i}r`, cls: 'ab-eq-rel', sym: r, num: r, wide: `${col + 1}|${wr}`, narrow: `2|${nr}` })
        out.push({ key: `${c}.${i}s`, cls: 'ab-eq-rhs', ...both(rhs), wide: `${col + 2}|${wr}`, narrow: `3|${nr}` })
      })
    })
    return { cells: out, columns: formeln.length }
  }, [formeln, specs, params])

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
    // Space belongs to the timeline
    if (e.key === 'Enter') {
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
  // the formula columns from the left, a flexible gap, the switch's column at the right edge
  const wideCols = Array.from({ length: columns }, () => 'auto auto auto').join(' var(--ab-col-gap) ') + ' minmax(var(--ab-col-gap), 1fr) auto'
  const switchCol = 4 * columns + 1

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
        <div className="ab-eqs" ref={grid} data-mode={mode} style={{ '--ab-wide-cols': wideCols } as CSSProperties}>
          {cells.map((c) => {
            const [wc, wr] = c.wide.split('|')
            const [nc, nr] = c.narrow.split('|')
            const style = { '--wc': wc, '--wr': wr, '--nc': nc, '--nr': nr } as CSSProperties
            if (c.cls === 'ab-eq-bracket') return <span key={c.key} className={c.cls} style={style} aria-hidden="true" />
            if (c.cls.startsWith('ab-eq-title'))
              return (
                <span key={c.key} className={c.cls} style={style}>
                  {c.sym}
                </span>
              )
            return (
              <span key={c.key} className={c.cls} style={style}>
                <span className="ab-dual">
                  <span data-v="symbole" aria-hidden={values || undefined} dangerouslySetInnerHTML={{ __html: c.sym }} />
                  <span data-v="zahlen" aria-hidden={!values || undefined} dangerouslySetInnerHTML={{ __html: c.num }} />
                </span>
              </span>
            )
          })}
          <span className="ab-eq-title ab-values-title" style={{ '--wc': switchCol, '--wr': 1, '--nc': '1 / -1', '--nr': 1 } as CSSProperties}>
            Parameter / Werte
          </span>
          <span className="ab-values-cell" style={{ '--wc': switchCol, '--wr': 2, '--nc': '1 / -1', '--nr': 2 } as CSSProperties}>
            <button
              type="button"
              className="ab-values"
              role="switch"
              aria-checked={values}
              aria-label="Werte statt Symbole zeigen"
              onClick={() => setMode(values ? 'symbole' : 'zahlen')}
              data-tip={values ? 'wieder die Symbole zeigen' : 'die aktuellen Werte einsetzen'}
            >
              <span className="ab-values-track" aria-hidden="true">
                <span className="ab-values-knob" />
                <span className="ab-values-opt ab-values-sym">a</span>
                <span className="ab-values-opt ab-values-num">1,5</span>
              </span>
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
