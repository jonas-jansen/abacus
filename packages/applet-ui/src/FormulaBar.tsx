import katex from 'katex'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { formatNumber, type ParamSpec, type Params } from '@abacus/applet-core'
import { expandFormula, formulaLines, splitRelation, type Formel, type FormulaMode } from './formula'

const SCRUB_PX = 5

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
    // only \htmlData, and only for the param attribute this component writes
    trust: (ctx) => ctx.command === '\\htmlData',
  })

/** The step a drag or arrow key moves a parameter by. */
function stepOf(spec: ParamSpec | undefined): number | null {
  if (!spec) return null
  if (spec.kind === 'real') return spec.step
  if (spec.kind === 'int') return 1
  return null
}

/**
 * The model as formulas, with its parameters live: point at a parameter to see it light up
 * in the controls and the plot, drag it sideways to change it, click it to type a value.
 * A toggle puts the current numbers in place of the symbols.
 */
export function FormulaBar({ formeln, specs, params, onChange, onHot, onFocusParam, hot }: FormulaBarProps) {
  const [mode, setMode] = useState<FormulaMode>('symbole')
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; x: number; v: number; moved: boolean } | null>(null)

  // One row per equation, all in one grid: label | left side | relation | right side. So every
  // "=" of every formula sits in one column, and start values line up with the equations.
  const rows = useMemo(() => {
    const tex = (t: string) => (t ? render(expandFormula(t, specs, params, mode)) : '')
    return formeln.flatMap((f, group) =>
      formulaLines(f.tex).map((line, i) => {
        const { lhs, rel, rhs } = splitRelation(line)
        return { key: `${group}.${i}`, label: i === 0 ? f.label : undefined, gap: i === 0 && group > 0, lhs: tex(lhs), rel: rel ? render(rel) : '', rhs: tex(rhs) }
      }),
    )
  }, [formeln, specs, params, mode])
  const grid = useRef<HTMLDivElement>(null)

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
    const natural = el.scrollWidth
    if (natural > width) {
      const base = parseFloat(getComputedStyle(el).fontSize)
      el.style.fontSize = `${Math.max(9, (base * width) / natural - 0.2)}px`
    }
  }, [rows, width])

  // KaTeX output is plain HTML: make the parameter spans reachable by keyboard and screen readers.
  useEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('[data-param]').forEach((el) => {
      const spec = specs.find((s) => s.id === el.dataset.param)
      if (!spec) return
      const v = params[spec.id]
      el.tabIndex = 0
      el.setAttribute('role', stepOf(spec) === null ? 'button' : 'slider')
      el.setAttribute('aria-label', spec.label)
      if (typeof v === 'number') el.setAttribute('aria-valuenow', String(v))
      el.title =
        spec.kind === 'bool' || spec.kind === 'choice'
          ? `${spec.label} – klicken zum Umschalten`
          : `${spec.label} = ${typeof v === 'number' ? formatNumber(v, 6) : String(v)} – ziehen zum Ändern, klicken zum Eintippen`
      el.toggleAttribute('data-hot', spec.id === hot)
    })
  })

  const target = (e: { target: EventTarget }) => (e.target as HTMLElement).closest<HTMLElement>('[data-param]')
  const specOf = (id: string) => specs.find((s) => s.id === id)

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = target(e)
    const id = el?.dataset.param
    if (!id || e.button !== 0) return
    const v = params[id]
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id, x: e.clientX, v: typeof v === 'number' ? v : NaN, moved: false }
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) {
      if (e.pointerType === 'mouse') onHot(target(e)?.dataset.param ?? null)
      return
    }
    const step = stepOf(specOf(d.id))
    const dx = e.clientX - d.x
    if (step === null || !Number.isFinite(d.v) || (!d.moved && Math.abs(dx) < 3)) return
    d.moved = true
    const k = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    onChange(d.id, d.v + Math.round(dx / SCRUB_PX) * step * k)
  }
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (d && !d.moved) activate(d.id)
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
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const id = target(e)?.dataset.param
    if (!id) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate(id)
      return
    }
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    const step = stepOf(specOf(id))
    const v = params[id]
    if (!dir || step === null || typeof v !== 'number') return
    e.preventDefault()
    onChange(id, v + dir * step * (e.shiftKey ? 10 : 1))
  }

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
        <div className="ab-eqs" ref={grid}>
          {rows.map((r) => (
            <Fragment key={r.key}>
              <span className="ab-eq-label" data-gap={r.gap || undefined}>
                {r.label}
              </span>
              <span className="ab-eq-lhs" data-gap={r.gap || undefined} dangerouslySetInnerHTML={{ __html: r.lhs }} />
              <span className="ab-eq-rel" data-gap={r.gap || undefined} dangerouslySetInnerHTML={{ __html: r.rel }} />
              <span className="ab-eq-rhs" data-gap={r.gap || undefined} dangerouslySetInnerHTML={{ __html: r.rhs }} />
            </Fragment>
          ))}
        </div>
      </div>
      <div className="ab-seg" role="group" aria-label="Formeln zeigen">
        <button type="button" aria-pressed={mode === 'symbole'} onClick={() => setMode('symbole')} title="Formeln mit Symbolen">
          Symbole
        </button>
        <button type="button" aria-pressed={mode === 'zahlen'} onClick={() => setMode('zahlen')} title="die aktuellen Zahlen einsetzen">
          Zahlen
        </button>
      </div>
    </div>
  )
}
