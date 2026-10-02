/**
 * The timeline under the plots: play and pause, step, scrub, the tempo button, and the horizon
 * (N or T) editable where it is shown.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatNumber, type IntParam, type RealParam } from '@abacus/applet-core'
import { accessibleName, NumberField } from './controls'

const Glyph = {
  play: <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" fill="currentColor" />,
  pause: <path d="M4.5 3h2.2v10H4.5zM9.3 3h2.2v10H9.3z" fill="currentColor" />,
  back: <path d="M10.5 3.5 5.5 8l5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  fwd: <path d="M5.5 3.5 10.5 8l-5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
}

/**
 * Playback tempo. A click on the button cycles ½× · 1× · 2× · 4×; dragging it sideways or the
 * mouse wheel over it sets any tempo from 0,1× to 10× (the same gesture as for numbers in the
 * panel) – there for those who look for it, out of the way for the rest. Kept for the visit.
 */
const TEMPI = [0.5, 1, 2, 4] as const
const TEMPO_MIN = 0.1
const TEMPO_MAX = 10
const tempoText = (t: number) => (t === 0.5 ? '½×' : `${formatNumber(t, 2)}×`)
/** Tempi on a log scale, rounded to two figures (0,1 · 0,13 · … · 1 · 1,2 · … · 10). */
const tempoRund = (t: number) => Number(Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, t)).toPrecision(2))

function useTempo(): [number, (t: number) => void] {
  const [tempo, setTempo] = useState(1)
  useEffect(() => {
    try {
      const t = Number(sessionStorage.getItem('abacus:tempo'))
      if (t >= TEMPO_MIN && t <= TEMPO_MAX) setTempo(t)
    } catch {
      // no storage: 1×
    }
  }, [])
  const set = (t: number) => {
    const r = tempoRund(t)
    setTempo(r)
    try {
      sessionStorage.setItem('abacus:tempo', String(r))
    } catch {
      // no storage: only this applet
    }
  }
  return [tempo, set]
}

/** The tempo button: click cycles the presets, drag sideways or wheel sets it finely. */
function TempoKnopf({ tempo, onTempo }: { tempo: number; onTempo: (t: number) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x: number; t: number; moved: boolean } | null>(null)
  // the wheel needs a non-passive listener to keep the page from scrolling
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      onTempo(tempo * 2 ** (-e.deltaY / 500))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  })
  const next = () => onTempo(TEMPI.find((t) => t > tempo + 1e-9) ?? TEMPI[0])
  return (
    <button
      ref={ref}
      type="button"
      className="ab-tempo"
      data-scrub={drag.current?.moved ? 'active' : undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, t: tempo, moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dx = e.clientX - d.x
        if (!d.moved && Math.abs(dx) < 3) return
        d.moved = true
        // 60 px to the right doubles the tempo
        onTempo(d.t * 2 ** (dx / 60))
      }}
      onPointerUp={(e) => {
        const d = drag.current
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
        if (d && !d.moved) next()
      }}
      onKeyDown={(e) => {
        // keyboard: Enter cycles (as a click), arrows fine-tune; Space plays
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') (e.preventDefault(), onTempo(tempo * 1.25))
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') (e.preventDefault(), onTempo(tempo / 1.25))
        if (e.key === 'Enter') (e.preventDefault(), next())
      }}
      aria-label={`Tempo ${tempoText(tempo)}`}
      data-tip={'Klick | ½× · 1× · 2× · 4×\n{Ziehen} | stufenlos 0,1× bis 10×\n{Rad} | ebenso'}
    >
      {tempoText(tempo)}
    </button>
  )
}

/**
 * Time as a timeline (§6.1): play it, scrub it, or step with ‹ ›. Iterations step through n;
 * continuous models run through t. At the right end everything is shown, and a longer
 * horizon stays fully shown.
 */
export function Timeline({
  value,
  min = 0,
  max,
  continuous = false,
  onChange,
  horizon,
}: {
  /** undefined: at the end, everything shown */
  value: number | undefined
  min?: number
  max: number
  continuous?: boolean
  onChange: (v: number | undefined) => void
  /** The parameter behind `max` (N or T): editable right here, where it is shown. */
  horizon?: {
    spec: RealParam | IntParam
    value: number
    onChange: (v: number) => void
    message?: string
    onInvalid?: (m: string) => void
  }
}) {
  const k = value ?? max
  const [playing, setPlaying] = useState(false)
  const [tempo, setTempo] = useTempo()
  const span = max - min
  // a horizon of 0 (typed) leaves nothing to play, but the field to change it stays
  const empty = !(span > 0)
  const inc = continuous ? span / 100 : 1
  const set = (v: number) => onChange(v >= max - 1e-9 * Math.max(1, Math.abs(max)) ? undefined : Math.max(min, v))
  const step = (v: number) => {
    setPlaying(false)
    set(v)
  }

  useEffect(() => {
    if (!playing) return
    const from = k >= max ? min : k
    // At 1×: a step every 0,45 s, so each can be followed, but no run longer than 12 s; the
    // whole continuous time window in 10 s. The tempo button scales both.
    const duration = (continuous ? 10_000 * ((max - from) / (span || 1)) : Math.min(12_000, (max - from) * 450)) / tempo
    const t0 = performance.now()
    let id = requestAnimationFrame(function tick(now) {
      const f = (now - t0) / duration
      const v = continuous ? from + (max - from) * f : from + Math.floor((max - from) * f)
      if (v >= max) {
        onChange(undefined)
        setPlaying(false)
        return
      }
      onChange(v)
      id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
    // restarting on every step would reset the clock; only start/stop, horizon and tempo matter
    // (a new tempo while playing goes on from where it is)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, max, min, tempo])

  // Space only plays and pauses – wherever the focus is in the applet (a focused button is
  // not pressed again; Enter still does that), and on a page with this applet alone also with
  // nothing focused. Typing in a field keeps its space.
  const bar = useRef<HTMLDivElement>(null)
  const emptyRef = useRef(empty)
  emptyRef.current = empty
  useEffect(() => {
    const root = bar.current?.closest('.ab-applet')
    if (!root) return
    const ours = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      if (!el || (el.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type)) || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return false
      if (root.contains(el)) return true
      return (el === document.body || el === document.documentElement) && document.querySelectorAll('.ab-applet').length === 1
    }
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.key !== ' ' || e.metaKey || e.ctrlKey || e.altKey || !ours(e.target) || document.querySelector('dialog[open]')) return
      e.preventDefault()
      if (!e.repeat && !emptyRef.current) setPlaying((p) => !p)
    }
    // a button would act on the key's release
    const up = (e: globalThis.KeyboardEvent) => e.key === ' ' && ours(e.target) && !document.querySelector('dialog[open]') && e.preventDefault()
    document.addEventListener('keydown', down)
    document.addEventListener('keyup', up)
    return () => {
      document.removeEventListener('keydown', down)
      document.removeEventListener('keyup', up)
    }
  }, [])
  const sym = continuous ? 't' : 'n'
  const show = (v: number) => (continuous ? formatNumber(v, 3) : formatNumber(v, 7))

  return (
    <div className="ab-timeline" role="group" aria-label={continuous ? 'Zeit' : 'Schritte'} ref={bar}>
      <button type="button" className="ab-play" disabled={empty} onClick={() => setPlaying(!playing)} aria-label={playing ? 'anhalten' : 'abspielen'} data-tip={playing ? '{Leer} | anhalten' : '{Leer} | abspielen'}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          {playing ? Glyph.pause : Glyph.play}
        </svg>
      </button>
      <button type="button" className="ab-stepbtn" onClick={() => step(k - inc)} disabled={k <= min} aria-label={continuous ? 'etwas zurück' : 'einen Schritt zurück'}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          {Glyph.back}
        </svg>
      </button>
      <input
        className="ab-scrub"
        type="range"
        min={min}
        max={max}
        step={continuous ? 'any' : 1}
        value={k}
        disabled={empty}
        style={{ '--fill': span ? (k - min) / span : 1 } as CSSProperties}
        onChange={(e) => step(+e.target.value)}
        aria-label={continuous ? 'Zeit t' : 'Schritt n'}
        aria-valuetext={`${sym} = ${show(k)} von ${show(max)}`}
      />
      <button type="button" className="ab-stepbtn" onClick={() => step(k + inc)} disabled={k >= max} aria-label={continuous ? 'etwas weiter' : 'einen Schritt weiter'}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          {Glyph.fwd}
        </svg>
      </button>
      <TempoKnopf tempo={tempo} onTempo={setTempo} />
      <output className="ab-timeline-n" aria-live="off">
        <span>
          {sym} = {show(k)}
        </span>
        <span className="ab-muted"> / </span>
      </output>
      {horizon ? (
        <NumberField
          className="ab-val ab-horizon"
          value={horizon.value}
          onCommit={horizon.onChange}
          onInvalid={horizon.onInvalid}
          label={accessibleName(horizon.spec)}
          scrubStep={horizon.spec.kind === 'int' ? Math.max(1, Math.round(horizon.value / 20)) : horizon.spec.step}
          scrubMin={horizon.spec.min}
        />
      ) : (
        <span className="ab-muted ab-timeline-max">{show(max)}</span>
      )}
      {horizon?.message && (
        <p className="ab-feedback ab-timeline-feedback" role="status">
          {horizon.message}
        </p>
      )}
    </div>
  )
}
