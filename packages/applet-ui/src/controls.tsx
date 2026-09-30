/**
 * Controls (§6.1). No knobs. One parameter is one row: typeset symbol and name, the value as
 * editable text, and a slider. Secondary tools (reset, Feinmodus, range ends) stay out of the
 * way until the row is hovered or focused; on touch screens they are always there, along with
 * ± steppers.
 *
 * The slider range is a suggestion: typed values may lie outside it, and it stretches.
 * Only hard limits restrict, and the reason is shown (see `explainChange` in core).
 */

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import {
  clamp,
  decimalsOf,
  formatNumber,
  parseNumber,
  roundTo,
  type BoolParam,
  type ChoiceParam,
  type IntParam,
  type ParamSpec,
  type ParamValue,
  type Point,
  type PointParam,
  type RealParam,
} from '@abacus/applet-core'
import { MathLabel } from './MathLabel'
import { TeX } from './TeX'

type Range = readonly [number, number]

const show = (v: number) => formatNumber(v, 8)

/** What an input field shows: always something the parser reads back (no "·10⁶"). */
function showInput(v: number): string {
  if (!Number.isFinite(v)) return String(v)
  const abs = Math.abs(v)
  if (Number.isInteger(v) && abs < 1e15) return formatNumber(v, 16)
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e9)) return v.toExponential(4).replace(/\.?0+e/, 'e').replace('e+', 'e').replace('.', ',').replace('-', '−')
  return formatNumber(v, 8)
}

/** Dragging a value sideways changes it: one step per 4 px, ×10 with Shift, ×0,1 with Alt. */
const SCRUB_PX = 4

export function NumberField({
  value,
  onCommit,
  onInvalid,
  label,
  className = 'ab-val',
  scrubStep,
  scrubMin,
}: {
  value: number
  onCommit: (v: number) => void
  onInvalid?: (message: string) => void
  label: string
  className?: string
  /** Allow changing the value by dragging it (mouse only; touch taps to type). */
  scrubStep?: number
  /** Dragging stops here (typing may still go further, within the parameter's hard limits). */
  scrubMin?: number
}) {
  const [text, setText] = useState(showInput(value))
  const [editing, setEditing] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const drag = useRef<{ x: number; v: number; moved: boolean; step: number } | null>(null)
  useEffect(() => {
    if (!editing) setText(showInput(value))
  }, [value, editing])
  const commit = () => {
    // Show the value actually used (it may have been clamped), even while the field keeps focus.
    setEditing(false)
    const v = parseNumber(text)
    if (v !== undefined) onCommit(v)
    else {
      if (text.trim() !== showInput(value)) onInvalid?.(`„${text.trim()}“ ist keine Zahl. Zum Beispiel 3,2 oder −0,5 oder 1e-3.`)
      setText(showInput(value))
    }
  }
  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text}
      size={Math.max(2, text.length)}
      data-scrub={scrubStep ? (scrubbing ? 'active' : 'ready') : undefined}
      data-tip={scrubStep ? '{Ziehen} | ziehen zum Ändern\nKlick | eintippen' : undefined}
      onPointerDown={(e) => {
        if (!scrubStep || e.pointerType !== 'mouse' || e.button !== 0 || document.activeElement === e.currentTarget) return
        e.preventDefault() // no focus, no text selection: this may become a drag
        e.currentTarget.setPointerCapture(e.pointerId)
        // the step is fixed for the whole drag, even if it depends on the value
        drag.current = { x: e.clientX, v: value, moved: false, step: scrubStep }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || !scrubStep) return
        const dx = e.clientX - d.x
        if (!d.moved && Math.abs(dx) < 3) return
        if (!d.moved) setScrubbing(true)
        d.moved = true
        const k = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
        const next = d.v + Math.round(dx / SCRUB_PX) * d.step * k
        onCommit(scrubMin === undefined ? next : Math.max(scrubMin, next))
      }}
      onPointerUp={(e) => {
        const d = drag.current
        drag.current = null
        if (!d) return
        e.currentTarget.releasePointerCapture(e.pointerId)
        setScrubbing(false)
        if (!d.moved) {
          e.currentTarget.focus()
          e.currentTarget.select()
        }
      }}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onChange={(e) => {
        setEditing(true)
        setText(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          setEditing(false)
          setText(showInput(value))
          e.currentTarget.blur()
        }
      }}
    />
  )
}

const Icon = {
  reset: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3.5 8a4.5 4.5 0 1 0 1.5-3.4M3.5 2.5v2.7h2.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  zoom: (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.2 10.2 3.3 3.3M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
}

/** Symbol (typeset) and name. Falls back to the name alone. */
function ParamLabel({ spec, htmlFor }: { spec: ParamSpec; htmlFor?: string }) {
  const sym = 'latex' in spec && spec.latex ? <TeX tex={spec.latex} className="ab-sym" /> : null
  const Tag = htmlFor ? 'label' : 'span'
  return (
    <Tag className="ab-label-param" htmlFor={htmlFor}>
      {sym}
      <span className={sym ? 'ab-name' : 'ab-name ab-name-only'}>{spec.label}</span>
    </Tag>
  )
}

/** A round number at or beyond v, for stretching the slider range: 3,7 → 4 · 5 300 → 6 000. */
function niceBeyond(v: number, up: boolean): number {
  if (v === 0) return 0
  const mag = 10 ** Math.floor(Math.log10(Math.abs(v)))
  return (up ? Math.ceil(v / mag) : Math.floor(v / mag)) * mag
}

const pct = (v: number, [lo, hi]: Range, log: boolean) =>
  hi > lo ? (log ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo)) : 0

const POS = 1000 // resolution of the log-scale slider

export interface SliderProps {
  spec: RealParam | IntParam
  value: number
  onChange: (v: number) => void
  /** Why the last input was changed or rejected. */
  message?: string
  onInvalid?: (message: string) => void
}

/** Name for screen readers and aria-labels: "Faktor a", "Startwert x0". */
export const accessibleName = (spec: ParamSpec) =>
  'latex' in spec && spec.latex ? `${spec.label} ${spec.latex.replace(/[{}_^\\]/g, '')}` : spec.label

export function Slider({ spec, value, onChange, message, onInvalid }: SliderProps) {
  const id = useId()
  const name = accessibleName(spec)
  const isInt = spec.kind === 'int'
  const baseStep = isInt ? 1 : spec.step
  const fineAllowed = !isInt && spec.fine !== false
  const log = spec.kind === 'real' && spec.scale === 'log' && spec.min > 0

  // The slider range is a suggestion. Values beyond it stretch it (until reset).
  const [base, setBase] = useState<Range>([spec.min, spec.max])
  const stretched = base[0] !== spec.min || base[1] !== spec.max
  useEffect(() => {
    if (!Number.isFinite(value)) return
    if (value > base[1]) setBase([base[0], niceBeyond(value, true)])
    else if (value < base[0]) setBase([log ? Math.max(value, Number.MIN_VALUE) : niceBeyond(value, false), base[1]])
  }, [value, base, log])

  const [windows, setWindows] = useState<Range[]>([])
  const win = windows.at(-1) ?? base
  const [lo, hi] = win
  const step = isInt ? 1 : baseStep / 10 ** windows.length
  const decimals = isInt ? 0 : decimalsOf(step)

  const set = (v: number) => onChange(isInt ? Math.round(v) : roundTo(v, decimals + 2))
  const nudge = (k: number) => set(roundTo(value + k * step, decimals + 1))

  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (dir) {
      e.preventDefault()
      const k = e.shiftKey ? 10 : e.altKey && !isInt ? 0.1 : 1
      set(roundTo(value + dir * k * step, decimals + (e.altKey ? 2 : 1)))
    } else if (e.key === 'Home') {
      e.preventDefault()
      set(lo)
    } else if (e.key === 'End') {
      e.preventDefault()
      set(hi)
    }
  }

  const zoom = () => {
    const d = (hi - lo) / 20
    setWindows([...windows, [Math.max(lo, value - d), Math.min(hi, value + d)]])
  }

  const fromSlider = (raw: number) => {
    if (!log) return isInt ? Math.round(raw) : roundTo(raw, decimals)
    return Number((lo * (hi / lo) ** (raw / POS)).toPrecision(3))
  }
  const fill = pct(clamp(value, lo, hi), win, log)
  const changed = value !== spec.default
  const zoomed = windows.length > 0

  // Shown under the slider only when there is something to say.
  let info: ReactNode = null
  if (zoomed) {
    info = (
      <>
        <span className="ab-info-strong">Lupe {10 ** windows.length}-fach</span>
        <span>
          {formatNumber(lo, 6)} … {formatNumber(hi, 6)}
        </span>
        <button type="button" className="ab-textbtn" onClick={() => setWindows(windows.slice(0, -1))}>
          {windows.length > 1 ? 'zurück' : 'Lupe aus'}
        </button>
        {windows.length > 1 && (
          <button type="button" className="ab-textbtn" onClick={() => setWindows([])}>
            Lupe aus
          </button>
        )}
      </>
    )
  } else if (stretched) {
    info = (
      <>
        <span>Regler erweitert bis {formatNumber(value < spec.min ? lo : hi, 6)}</span>
        <button type="button" className="ab-textbtn" onClick={() => setBase([Math.min(spec.min, value), Math.max(spec.max, value)])}>
          zurücksetzen
        </button>
      </>
    )
  }

  return (
    <div className="ab-param" data-active={zoomed || undefined}>
      <div className="ab-param-head">
        <ParamLabel spec={spec} htmlFor={id} />
        <span className="ab-tools">
          {changed && (
            <button type="button" className="ab-tool" onClick={() => onChange(spec.default)} data-tip={`zurück auf ${show(spec.default)}`} aria-label={`${name} zurücksetzen`}>
              {Icon.reset}
            </button>
          )}
          {fineAllowed && (
            <button
              type="button"
              className="ab-tool"
              onClick={zoom}
              aria-pressed={zoomed}
              data-tip="Feinmodus: Bereich um den Wert auf ein Zehntel verengen"
              aria-label={`Feinmodus für ${name}`}
            >
              {Icon.zoom}
            </button>
          )}
        </span>
        <span className="ab-value">
          <button type="button" className="ab-nudge" onClick={() => nudge(-1)} aria-label={`${name} verkleinern`} tabIndex={-1}>
            −
          </button>
          <NumberField value={value} onCommit={(v) => set(roundTo(v, decimals + 2))} onInvalid={onInvalid} label={name} scrubStep={step} />
          <button type="button" className="ab-nudge" onClick={() => nudge(1)} aria-label={`${name} vergrößern`} tabIndex={-1}>
            +
          </button>
          {!isInt && spec.unit && <span className="ab-unit">{spec.unit}</span>}
        </span>
      </div>
      <div className="ab-slider">
        <span className="ab-end" aria-hidden="true">
          {formatNumber(lo, 5)}
        </span>
        <input
          id={id}
          className="ab-range"
          type="range"
          min={log ? 0 : lo}
          max={log ? POS : hi}
          step="any"
          value={log ? fill * POS : clamp(value, lo, hi)}
          style={{ '--fill': fill } as CSSProperties}
          data-outside={value < lo || value > hi || undefined}
          onChange={(e) => set(fromSlider(+e.target.value))}
          onKeyDown={onKey}
          aria-valuetext={show(value)}
        />
        <span className="ab-end" aria-hidden="true">
          {formatNumber(hi, 5)}
        </span>
      </div>
      {info && <div className="ab-info">{info}</div>}
      {message && (
        <p className="ab-feedback" role="status">
          {message}
        </p>
      )}
    </div>
  )
}

export function Choice({ spec, value, onChange }: { spec: ChoiceParam; value: string; onChange: (v: string) => void }) {
  const name = useId()
  return (
    <fieldset className="ab-param ab-fieldset">
      <legend className="ab-param-head">
        <ParamLabel spec={spec} />
      </legend>
      <div className="ab-choice">
        {spec.options.map((o) => (
          <label key={o.value} data-active={o.value === value || undefined}>
            <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
            <MathLabel text={o.label} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Switch({ spec, value, onChange }: { spec: BoolParam; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="ab-param">
      <div className="ab-param-head">
        <ParamLabel spec={spec} />
        <button type="button" className="ab-switch" role="switch" aria-checked={value} onClick={() => onChange(!value)}>
          <span className="ab-switch-text">{value ? spec.labelOn : spec.labelOff}</span>
          <span className="ab-switch-knob" />
        </button>
      </div>
    </div>
  )
}

export function PointInput({ spec, value, onChange }: { spec: PointParam; value: Point; onChange: (v: Point) => void }) {
  return (
    <div className="ab-param">
      <div className="ab-param-head">
        <ParamLabel spec={spec} />
        <span className="ab-value ab-point">
          (<NumberField value={value[0]} onCommit={(x) => onChange([x, value[1]])} label={`${accessibleName(spec)}, erste Koordinate`} />
          <span className="ab-sep">;</span>
          <NumberField value={value[1]} onCommit={(y) => onChange([value[0], y])} label={`${accessibleName(spec)}, zweite Koordinate`} />)
        </span>
      </div>
      <p className="ab-hint">im Bild ziehen oder eintippen</p>
    </div>
  )
}

export function ParamControl({
  spec,
  value,
  onChange,
  message,
  onInvalid,
}: {
  spec: ParamSpec
  value: ParamValue
  onChange: (v: ParamValue) => void
  message?: string
  onInvalid?: (message: string) => void
}) {
  switch (spec.kind) {
    case 'real':
    case 'int':
      return <Slider spec={spec} value={value as number} onChange={onChange} message={message} onInvalid={onInvalid} />
    case 'choice':
      return <Choice spec={spec} value={value as string} onChange={onChange} />
    case 'bool':
      return <Switch spec={spec} value={value as boolean} onChange={onChange} />
    case 'point':
      return <PointInput spec={spec} value={value as Point} onChange={onChange} />
  }
}
