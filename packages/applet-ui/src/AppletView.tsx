import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { decimalsOf, explainChange, formatNumber, roundTo, type Observable, type Params, type ParamSpec, type ParamValue } from '@abacus/applet-core'
import { subscribe } from '@abacus/channel'
import { ParamControl } from './controls'
import { handlesOf, type AppletDef } from './define'
import { Figure } from './Figure'
import { Figure3D, type Spec3D } from './Figure3D'
import { MathLabel } from './MathLabel'
import { useAppletState } from './useAppletState'

export interface AppletViewProps<P extends Params> {
  def: AppletDef<P>
  /** Opening parameters. */
  zustand?: Readonly<Record<string, unknown>>
  /** Hide the plots until an `applet/unlock` message arrives (e.g. from a prediction quiz). */
  gesperrt?: boolean
  /** Text on the locked panel. */
  sperrText?: string
  /** Show title and description. Off when the surrounding page already does. */
  kopf?: boolean
  /** Link to the applet's own page, shown as an icon in the header. */
  vollbildHref?: string
}

/** A readout (or one entry of it) the student points at: its marks light up in the plots. */
interface Spot {
  id: string
  item?: number
}

export function AppletView<P extends Params>({ def, zustand, gesperrt = false, sperrText, kopf = true, vollbildHref }: AppletViewProps<P>) {
  const { params, setParams, reset, run, error } = useAppletState(def, zustand)
  const [locked, setLocked] = useState(gesperrt)
  useEffect(() => (gesperrt ? subscribe('applet/unlock', () => setLocked(false), { id: def.id }) : undefined), [gesperrt, def.id])

  // The timeline: steps n for iterations, time t for continuous models.
  const iterative = def.model.kind === 'iteration'
  const timeline = def.zeitleiste ?? def.model.kind !== 'closedForm'
  const clock = run?.series.find((s) => s.kind === (iterative ? 'discrete' : 'continuous'))
  const [tMin, tMax] = clock?.x.length ? [clock.x[0], clock.x[clock.x.length - 1]] : [0, 0]
  const [cursor, setCursor] = useState<number | undefined>(def.schritte ? 0 : undefined)
  useEffect(() => {
    if (cursor !== undefined && cursor > tMax) setCursor(undefined)
  }, [cursor, tMax])
  // A stable object, so pointing at things does not redraw the canvas.
  const view = useMemo(() => (iterative ? { steps: cursor } : { time: cursor }), [iterative, cursor])

  const shown = (s: ParamSpec) => def.layout?.sichtbar?.[s.id]?.(params) ?? true
  const specs = def.model.params.filter(shown)
  const all = def.model.params
  const main = def.layout?.main ?? (all.length <= 4 ? all.map((s) => s.id) : all.slice(0, 3).map((s) => s.id))
  const primary = specs.filter((s) => main.includes(s.id))
  const more = specs.filter((s) => !main.includes(s.id))

  // Linked highlighting: readouts → marks in the plots; plots → the same step everywhere;
  // a parameter row → its handle in the plot.
  const [hover, setHover] = useState<Spot | null>(null)
  const [pinned, setPinned] = useState<Spot | null>(null)
  const [probe, setProbe] = useState<number | null>(null)
  const [hotParam, setHotParam] = useState<string | null>(null)
  // the other direction: a handle in the plot is hovered or dragged → its slider row lights up
  const [dragged, setDragged] = useState<string | null>(null)
  const spot = hover ?? pinned
  const marks = useMemo(() => {
    const o = spot && run?.observables[spot.id]
    if (!spot || !o?.marks?.length) return null
    return spot.item === undefined ? o.marks : o.marks.filter((m) => m.item === undefined || m.item === spot.item)
  }, [spot, run])

  // Why an input was adjusted or rejected, per parameter. Cleared by the next clean change.
  const [hints, setHints] = useState<Record<string, string | undefined>>({})
  const change = (id: string, raw: unknown) => {
    const r = explainChange(def.model, params, id, raw)
    setParams(r.params)
    setHints((h) => ({ ...h, [id]: r.message }))
  }
  const control = (s: ParamSpec) => (
    <div key={s.id} className="ab-param-wrap" data-hot={dragged === s.id || undefined} onPointerEnter={() => setHotParam(s.id)} onPointerLeave={() => setHotParam(null)}>
      <ParamControl
        spec={s}
        value={params[s.id]}
        onChange={(v) => change(s.id, v)}
        message={hints[s.id]}
        onInvalid={(m) => setHints((h) => ({ ...h, [s.id]: m }))}
      />
    </div>
  )
  // Handle drags arrive at pixel precision: snap to one decimal finer than the slider's step.
  const dragTo = (patch: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    for (const [id, v] of Object.entries(patch)) out[id] = snap(all.find((s) => s.id === id), v as ParamValue)
    setParams(out)
  }
  const texOf = (id: string) => {
    const s = all.find((x) => x.id === id)
    return s && 'latex' in s && s.latex ? s.latex : undefined
  }

  return (
    <section className="ab-applet" aria-label={def.titel} data-applet={def.id}>
      {kopf && (
        <header className="ab-head">
          <div>
            <h2 className="ab-title">{def.titel}</h2>
            <p className="ab-sub">{def.kurz}</p>
          </div>
          {vollbildHref && (
            <a className="ab-icon" href={vollbildHref} title="Applet auf eigener Seite öffnen" aria-label="Applet auf eigener Seite öffnen">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="M12 3h5v5M17 3l-6 6M8 17H3v-5M3 17l6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </a>
          )}
        </header>
      )}

      <div className="ab-body">
        <div className="ab-stage">
          {locked ? (
            <div className="ab-locked" role="status">
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <p>{sperrText ?? 'Erst vorhersagen, dann nachsehen.'}</p>
            </div>
          ) : (
            <>
              {error && <p className="ab-error">Fehler bei der Berechnung: {error}</p>}
              {run && (
                <div className="ab-figures" data-count={def.plots.length}>
                  {def.plots.map((entry, i) =>
                    entry.type === 'surface3d' ? (
                      <Figure3D key={i} spec={entry as Spec3D} run={run} dragParam={handlesOf(entry)[0]?.param} onParams={dragTo} />
                    ) : (
                    <Figure
                      key={i}
                      entry={entry}
                      params={params}
                      run={run}
                      view={view}
                      onParams={dragTo}
                      marks={marks}
                      probe={probe}
                      onProbe={setProbe}
                      texOf={texOf}
                      hotParam={hotParam}
                      onHandle={setDragged}
                    />
                    ),
                  )}
                </div>
              )}
              {timeline && run && clock && tMax > tMin && <Timeline value={cursor} min={tMin} max={tMax} continuous={!iterative} onChange={setCursor} />}
              {run?.meta.warnings?.map((w) => (
                <p key={w} className="ab-note">
                  {w}
                </p>
              ))}
            </>
          )}
        </div>

        <aside className="ab-panel">
          <div className="ab-panel-section">
            <div className="ab-section-head">
              <h3>Parameter</h3>
              <span className="ab-head-tools">
                <CopyLink />
                <button type="button" className="ab-textbtn" onClick={reset} title="alle Parameter auf den Ausgangszustand">
                  alle zurücksetzen
                </button>
              </span>
            </div>
            <div className="ab-controls">{primary.map(control)}</div>
            {more.length > 0 && (
              <details className="ab-more">
                <summary>weitere Parameter ({more.length})</summary>
                <div className="ab-controls">{more.map(control)}</div>
              </details>
            )}
            {def.model.constraintNote && <p className="ab-note">Es gilt: {def.model.constraintNote}.</p>}
          </div>
          {run && !locked && def.anzeige && def.anzeige.length > 0 && (
            <div className="ab-panel-section">
              <div className="ab-section-head">
                <h3>Messwerte</h3>
              </div>
              <dl className="ab-stats" onPointerLeave={() => setHover(null)}>
                {def.anzeige.map((id) => {
                  const o = run.observables[id]
                  if (!o) return null
                  return (
                    <Readout
                      key={id}
                      o={o}
                      active={spot?.id === id ? (spot.item ?? 'all') : null}
                      pinned={pinned?.id === id}
                      onSpot={(item) => setHover(item === null ? null : { id, item })}
                      onPin={() => setPinned(pinned?.id === id ? null : { id })}
                    />
                  )
                })}
              </dl>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function snap(spec: ParamSpec | undefined, v: ParamValue): ParamValue {
  if (!spec) return v
  if (spec.kind === 'real' && typeof v === 'number') return roundTo(v, decimalsOf(spec.step) + 1)
  if (spec.kind === 'int' && typeof v === 'number') return Math.round(v)
  if (spec.kind === 'point' && Array.isArray(v)) {
    const d = (span: number) => Math.max(0, Math.ceil(-Math.log10(span / 1000)))
    return [roundTo(v[0], d(spec.xBounds[1] - spec.xBounds[0])), roundTo(v[1], d(spec.yBounds[1] - spec.yBounds[0]))]
  }
  return v
}

const valueText = (o: Observable, v: number) => (o.kind === 'index' ? String(v) : formatNumber(v, o.digits ?? 4))

/**
 * One measurement. Values are chips; when the observable has marks, pointing at the row
 * (or a single chip) highlights them in the plots, and a click keeps them highlighted.
 */
function Readout({
  o,
  active,
  pinned,
  onSpot,
  onPin,
}: {
  o: Observable
  active: number | 'all' | null
  pinned: boolean
  onSpot: (item: number | undefined | null) => void
  onPin: () => void
}) {
  const v = o.value
  const missing = v === null || (Array.isArray(v) && v.length === 0)
  const linked = !!o.marks?.length
  const perItem = linked && o.marks!.some((m) => m.item !== undefined)

  let values: { text: string; item?: number }[]
  if (v === null) values = []
  else if (o.format) values = [{ text: o.format(v) }]
  else if (Array.isArray(v)) values = v.map((x, item) => ({ text: valueText(o, x), item: perItem ? item : undefined }))
  else if (typeof v === 'number') values = [{ text: valueText(o, v) }]
  else values = [{ text: String(v) }]

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPin()
    }
  }

  return (
    <div
      className="ab-stat"
      data-missing={missing || undefined}
      data-linked={linked || undefined}
      data-active={active !== null || undefined}
      data-kind={o.kind}
      onPointerEnter={() => onSpot(linked ? undefined : null)}
      {...(linked
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': pinned,
            title: pinned ? 'Markierung im Bild aufheben' : 'im Bild zeigen',
            onFocus: () => onSpot(undefined),
            onBlur: () => onSpot(null),
            onClick: onPin,
            onKeyDown: onKey,
          }
        : {})}
    >
      <dt>
        <MathLabel text={o.label} />
        {linked && (
          <svg className="ab-stat-link" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="1.6" fill="currentColor" />
          </svg>
        )}
      </dt>
      <dd>
        {missing ? (
          <span className="ab-stat-none">{v === null ? '—' : 'keine'}</span>
        ) : (
          values.map((x, i) => (
            <span
              key={i}
              className="ab-chip"
              data-active={active === 'all' || (x.item !== undefined && active === x.item) || undefined}
              onPointerEnter={x.item !== undefined ? () => onSpot(x.item) : undefined}
              onPointerLeave={x.item !== undefined ? () => onSpot(undefined) : undefined}
            >
              {x.text}
            </span>
          ))
        )}
        {missing && o.note && <span className="ab-stat-note">{o.note}</span>}
      </dd>
    </div>
  )
}

/** Copies the current link, which carries the parameters in its hash. */
function CopyLink() {
  const [done, setDone] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    try {
      // the hash is written with a short delay after the last change
      await new Promise((r) => setTimeout(r, 300))
      await navigator.clipboard.writeText(window.location.href)
      setDone(true)
      timer.current = window.setTimeout(() => setDone(false), 1600)
    } catch {
      /* clipboard unavailable: nothing to do */
    }
  }
  return (
    <button type="button" className="ab-textbtn ab-copy" onClick={copy} title="Link zu genau diesem Zustand kopieren" data-done={done || undefined}>
      {done ? 'kopiert ✓' : 'Link kopieren'}
    </button>
  )
}

const Glyph = {
  play: <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" fill="currentColor" />,
  pause: <path d="M4.5 3h2.2v10H4.5zM9.3 3h2.2v10H9.3z" fill="currentColor" />,
  back: <path d="M10.5 3.5 5.5 8l5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  fwd: <path d="M5.5 3.5 10.5 8l-5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
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
}: {
  /** undefined: at the end, everything shown */
  value: number | undefined
  min?: number
  max: number
  continuous?: boolean
  onChange: (v: number | undefined) => void
}) {
  const k = value ?? max
  const [playing, setPlaying] = useState(false)
  const span = max - min
  const inc = continuous ? span / 100 : 1
  const set = (v: number) => onChange(v >= max - 1e-9 * Math.max(1, Math.abs(max)) ? undefined : Math.max(min, v))
  const step = (v: number) => {
    setPlaying(false)
    set(v)
  }

  useEffect(() => {
    if (!playing) return
    const from = k >= max ? min : k
    // Quick for short runs, never longer than 8 s for long ones; continuous time in 6 s.
    const duration = continuous ? 6000 * ((max - from) / (span || 1)) : Math.min(8000, Math.max(1500, (max - from) * 140))
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
    // restarting on every step would reset the clock; only start/stop and the horizon matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, max, min])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault()
      setPlaying((p) => !p)
    }
  }
  const sym = continuous ? 't' : 'n'
  const show = (v: number) => (continuous ? formatNumber(v, 3) : formatNumber(v, 7))

  return (
    <div className="ab-timeline" role="group" aria-label={continuous ? 'Zeit' : 'Schritte'} onKeyDown={onKey}>
      <button type="button" className="ab-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'anhalten' : 'abspielen'} title={playing ? 'anhalten (Leertaste)' : 'abspielen (Leertaste)'}>
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
      <output className="ab-timeline-n" aria-live="off">
        <span>
          {sym} = {show(k)}
        </span>
        <span className="ab-muted"> / {show(max)}</span>
      </output>
    </div>
  )
}
