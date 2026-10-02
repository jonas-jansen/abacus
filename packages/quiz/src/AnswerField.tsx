/**
 * The input for one question, by type – used on course pages and in weekly quizzes alike.
 * Controlled: the caller holds the answer. With `reveal` it shows what was right.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ContentView } from './Content'
import { isImage, type Content, type MatchQuiz, type MultipleChoiceQuiz, type QuizDef, type SingleChoiceQuiz } from './define'
import { rightItems, shuffleOrder } from './grading'
import { MathText } from './MathText'

export interface AnswerFieldProps {
  def: QuizDef
  value: unknown
  onChange: (v: unknown) => void
  /** Submitted: no more changes. */
  locked?: boolean
  /** Mark right and wrong choices (after submitting, when solutions may show). */
  reveal?: boolean
  /** Seed of the option order (quiz id and attempt), so a reload shows the same order. */
  seed: string
}

export function AnswerField(p: AnswerFieldProps) {
  switch (p.def.type) {
    case 'single':
    case 'multiple':
      return <Choice {...p} def={p.def} />
    case 'match':
      return <Match {...p} def={p.def} />
    case 'number':
    case 'find':
      return <NumberField {...p} quantity={p.def.quantity} unit={p.def.unit} />
    case 'prediction':
      if (p.def.options) return <Choice {...p} def={{ ...p.def, type: 'single', options: p.def.options, correct: -1, shuffle: false }} valueIsText />
      return <TextField {...p} rows={2} />
    default:
      return <TextField {...p} rows={4} />
  }
}

const Check = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const Cross = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

/** Single or multiple choice, as cards. Options may be shuffled; the answer keeps definition indices. */
function Choice({
  def,
  value,
  onChange,
  locked,
  reveal,
  seed,
  valueIsText = false,
}: Omit<AnswerFieldProps, 'def'> & { def: SingleChoiceQuiz | MultipleChoiceQuiz; valueIsText?: boolean }) {
  const multiple = def.type === 'multiple'
  const order = def.shuffle === false ? def.options.map((_, i) => i) : shuffleOrder(def.options.length, seed)
  const right = new Set(multiple ? def.correct : [def.correct])
  const chosen = (i: number) =>
    multiple ? Array.isArray(value) && (value as number[]).includes(i) : valueIsText ? value === def.options[i] : value === i
  const toggle = (i: number) => {
    if (locked) return
    if (!multiple) return onChange(valueIsText ? def.options[i] : i)
    const old = Array.isArray(value) ? (value as number[]) : []
    onChange(old.includes(i) ? old.filter((x) => x !== i) : [...old, i].sort((a, b) => a - b))
  }
  const pictures = def.options.some(isImage)
  return (
    <div className="qz-options" role={multiple ? 'group' : 'radiogroup'} data-multiple={multiple || undefined} data-pictures={pictures || undefined}>
      {multiple && !locked && <p className="qz-instruction">Mehrere Antworten können stimmen.</p>}
      {order.map((i) => {
        const on = chosen(i)
        const mark = reveal ? (right.has(i) ? 'correct' : on ? 'wrong' : undefined) : undefined
        return (
          <label key={i} className="qz-option" data-on={on || undefined} data-mark={mark} data-locked={locked || undefined}>
            <input type={multiple ? 'checkbox' : 'radio'} checked={on} disabled={locked} onChange={() => toggle(i)} />
            <span className="qz-indicator" aria-hidden="true">
              {mark === 'correct' ? <Check /> : mark === 'wrong' ? <Cross /> : multiple && on ? <Check /> : null}
            </span>
            <ContentView c={def.options[i]} className="qz-option-content" />
          </label>
        )
      })}
    </div>
  )
}

type Source = { r: number; from: number | null }
type Drag = Source & { x: number; y: number; dx: number; dy: number; width: number; moved: boolean; over: number | 'pool' | null }

/**
 * Matching: drag each answer card onto the slot beside its partner – with the mouse or a
 * finger. A card dropped on a filled slot swaps places; dragged back to the pile, it is free
 * again. Without dragging: click a card, then a slot (keyboard: Enter on both).
 */
function Match({ def, value, onChange, locked, reveal, seed }: Omit<AnswerFieldProps, 'def'> & { def: MatchQuiz }) {
  const right = rightItems(def)
  const order = shuffleOrder(right.length, seed)
  const chosen: (number | null)[] = Array.isArray(value) ? (value as (number | null)[]) : def.pairs.map(() => null)
  const used = new Set(chosen.filter((x): x is number => x !== null))
  const [picked, setPicked] = useState<Source | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  // near the top or bottom edge, the page scrolls on its own, so far slots stay reachable
  const edge = useRef(0)
  useEffect(() => {
    if (!drag) return
    const id = window.setInterval(() => edge.current && window.scrollBy(0, edge.current), 16)
    return () => window.clearInterval(id)
  }, [!drag])

  const place = (src: Source, target: number | 'pool' | null) => {
    if (target === null) return
    const next = [...chosen]
    if (target === 'pool') {
      if (src.from !== null) next[src.from] = null
    } else {
      const before = next[target]
      next[target] = src.r
      if (src.from !== null && src.from !== target) next[src.from] = before
    }
    onChange(next)
    setPicked(null)
  }

  const targetAt = (x: number, y: number): number | 'pool' | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot], [data-pool]')
    if (!el) return null
    return el.dataset.slot !== undefined ? Number(el.dataset.slot) : 'pool'
  }

  const down = (e: ReactPointerEvent<HTMLElement>, src: Source) => {
    if (locked || e.button !== 0) return
    e.preventDefault() // no text selection while dragging
    const box = e.currentTarget.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { ...src, x: e.clientX, y: e.clientY, dx: e.clientX - box.left, dy: e.clientY - box.top, width: box.width, moved: false, over: null }
  }
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d) return
    const moved = d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5
    const next = { ...d, x: e.clientX, y: e.clientY, moved, over: moved ? targetAt(e.clientX, e.clientY) : null }
    dragRef.current = next
    const zone = 70
    edge.current = !moved ? 0 : e.clientY < zone ? -Math.ceil((zone - e.clientY) / 6) : e.clientY > window.innerHeight - zone ? Math.ceil((e.clientY - window.innerHeight + zone) / 6) : 0
    if (moved) setDrag(next)
  }
  const up = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current
    dragRef.current = null
    edge.current = 0
    setDrag(null)
    if (!d) return
    if (d.moved) place(d, targetAt(e.clientX, e.clientY))
    else setPicked((p) => (p && p.r === d.r && p.from === d.from ? null : { r: d.r, from: d.from }))
  }

  const card = (r: number, from: number | null) => (
    <span
      key={r}
      className="qz-card"
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-pressed={picked?.r === r && picked.from === from}
      data-dragging={drag?.r === r || undefined}
      data-locked={locked || undefined}
      onPointerDown={(e) => down(e, { r, from })}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        dragRef.current = null
        edge.current = 0
        setDrag(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !locked) setPicked(picked?.r === r && picked.from === from ? null : { r, from })
      }}
    >
      <span className="qz-grip" aria-hidden="true" />
      <ContentView c={right[r]} />
    </span>
  )

  const free = order.filter((r) => !used.has(r))
  return (
    <div className="qz-match" data-pictures={right.some(isImage) || undefined}>
      {!locked && <p className="qz-instruction">Ziehen Sie jede Antwort auf das Feld neben ihrem Partner.</p>}
      <ol className="qz-match-rows">
        {def.pairs.map(([left], l) => {
          const r = chosen[l]
          const ok = reveal ? r === l : undefined
          return (
            <li key={l} className="qz-match-row" data-mark={ok === undefined ? undefined : ok ? 'correct' : 'wrong'}>
              <ContentView c={left} className="qz-match-left" />
              <span className="qz-match-arrow" aria-hidden="true">→</span>
              <span
                className="qz-slot"
                data-slot={l}
                data-over={drag?.over === l || undefined}
                data-armed={(picked && !locked) || undefined}
                role={picked && !locked ? 'button' : undefined}
                tabIndex={picked && !locked ? 0 : undefined}
                onClick={() => picked && !locked && place(picked, l)}
                onKeyDown={(e) => e.key === 'Enter' && picked && !locked && place(picked, l)}
              >
                {r !== null && r !== undefined ? card(r, l) : <span className="qz-slot-empty">{locked ? '–' : 'hierher ziehen'}</span>}
              </span>
              {reveal && !ok && (
                <span className="qz-match-fix">
                  richtig: <ContentView c={right[l]} />
                </span>
              )}
            </li>
          )
        })}
      </ol>
      {!locked && (
        <div
          className="qz-pool"
          data-pool=""
          data-over={drag?.over === 'pool' || undefined}
          onClick={() => picked && picked.from !== null && place(picked, 'pool')}
          aria-label="Antworten"
        >
          {free.map((r) => card(r, null))}
          {free.length === 0 && <span className="qz-pool-empty">Alle Antworten liegen.</span>}
        </div>
      )}
      {drag && drag.moved && (
        <span className="qz-card qz-ghost" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.width }} aria-hidden="true">
          <span className="qz-grip" />
          <ContentView c={right[drag.r] as Content} />
        </span>
      )}
    </div>
  )
}

function NumberField({ value, onChange, locked, quantity, unit }: Omit<AnswerFieldProps, 'def' | 'seed'> & { quantity?: string; unit?: string }) {
  return (
    <label className="qz-field">
      {quantity && (
        <>
          <MathText text={quantity} className="qz-var" />
          <span>=</span>
        </>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        aria-label={quantity ? undefined : 'Ihre Zahl'}
      />
      {unit && <span className="qz-muted">{unit}</span>}
    </label>
  )
}

function TextField({ value, onChange, locked, rows }: Omit<AnswerFieldProps, 'def' | 'seed'> & { rows: number }) {
  return <textarea className="qz-text" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} rows={rows} disabled={locked} aria-label="Ihre Antwort" />
}
