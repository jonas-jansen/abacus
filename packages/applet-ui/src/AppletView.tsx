import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { decimalsOf, defaultParams, explainChange, formatNumber, roundTo, updateParams, type Detail, type Run, type IntParam, type Observable, type Params, type ParamSpec, type ParamValue, type RealParam } from '@abacus/applet-core'
import { subscribe } from '@abacus/channel'
import { accessibleName, NumberField, ParamControl } from './controls'
import { handlesOf, type AppletDef, type PlotEntry } from './define'
import { Figure } from './Figure'
import { Figure3D, type Spec3D } from './Figure3D'
import { FormulaBar } from './FormulaBar'
import { MathLabel } from './MathLabel'
import { useAppletState } from './useAppletState'
import { installTips } from './tip'
import { useHistory } from './useHistory'

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
  const history = useHistory(params, (p) => setParams(p))

  // Phase portrait: further trajectories, one per clicked start (the same model, another start).
  const [starts, setStarts] = useState<readonly [number, number][]>([])
  const startParamOf = (entry: PlotEntry<P>) =>
    entry.type === 'phasePlane' && entry.bahnen ? handlesOf(entry).find((h) => def.model.params.find((s) => s.id === h.param)?.kind === 'point')?.param : undefined
  const bahnParam = def.plots.map(startParamOf).find(Boolean)
  const bahnen = useMemo(() => {
    if (!bahnParam || !starts.length) return []
    const opts = { ...(def.runOptions?.(params) ?? {}), observables: false }
    return starts.map((s) => def.model.run(updateParams(def.model, params, { [bahnParam]: s }), opts))
  }, [bahnParam, starts, params, def])
  const MAX_BAHNEN = 12

  // A zoomed figure asks for its window in more detail: the same run, sampled for that window.
  const detailFor = useCallback(
    (at: P, d: Detail) => {
      try {
        return def.model.run(at, { ...(def.runOptions?.(at) ?? {}), detail: d, observables: false })
      } catch {
        return null
      }
    },
    [def],
  )
  const detail = useCallback((d: Detail) => detailFor(params, d), [detailFor, params])

  // Compare: a state held on to, drawn faintly behind the current one.
  const [vergleich, setVergleich] = useState<{ params: P; run: Run } | null>(null)
  // the held state, zoomed the same way (stable, so pointing at things does not recompute it)
  const vergleichDetail = useCallback((d: Detail) => (vergleich ? detailFor(vergleich.params, d) : null), [vergleich, detailFor])
  const vergleichText = useMemo(() => {
    if (!vergleich) return ''
    // what differs from now, in symbols: "festgehalten: $a$ = 2,8"
    const diff = def.model.params
      .filter((s) => s.id !== def.horizont && JSON.stringify(vergleich.params[s.id]) !== JSON.stringify(params[s.id]))
      .slice(0, 2)
      .map((s) => {
        const v = vergleich.params[s.id]
        const text = typeof v === 'number' ? formatNumber(v, 3) : Array.isArray(v) ? `(${v.map((c) => formatNumber(c, 3)).join('; ')})` : String(v)
        return 'latex' in s && s.latex ? `$${s.latex}$ = ${text}` : `${s.label} = ${text}`
      })
    return diff.length ? `festgehalten: ${diff.join(', ')}` : 'festgehalten'
  }, [vergleich, params, def])
  // ⌘Z / Ctrl-Z anywhere in the applet — except in text fields, which keep their own undo
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'text') return
    if (t.tagName === 'TEXTAREA') return
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) history.redo()
      else history.undo()
    } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      history.redo()
    }
  }
  const [locked, setLocked] = useState(gesperrt)
  useEffect(() => (gesperrt ? subscribe('applet/unlock', () => setLocked(false), { id: def.id }) : undefined), [gesperrt, def.id])

  // The timeline: steps n for iterations, time t for continuous models.
  // steps for iterations and for sequences given by a formula; time otherwise
  const iterative = def.model.kind === 'iteration' || run?.series[0]?.kind === 'discrete'
  const timeline = def.zeitleiste ?? def.model.kind !== 'closedForm'
  const clock = run?.series.find((s) => s.kind === (iterative ? 'discrete' : 'continuous'))
  const [tMin, tMax] = clock?.x.length ? [clock.x[0], clock.x[clock.x.length - 1]] : [0, 0]
  const [cursor, setCursor] = useState<number | undefined>(def.schritte ? 0 : undefined)
  useEffect(installTips, [])
  useEffect(() => {
    if (cursor !== undefined && cursor > tMax) setCursor(undefined)
  }, [cursor, tMax])
  // A stable object, so pointing at things does not redraw the canvas.
  // Legend: series switched off, and the one pointed at — shared by all figures of the applet.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [focusSeries, setFocusSeries] = useState<string | null>(null)
  const toggleSeries = (id: string) =>
    setHidden((h) => {
      const next = new Set(h)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const view = useMemo(
    () => ({ ...(iterative ? { steps: cursor } : { time: cursor }), hidden, focus: focusSeries }),
    [iterative, cursor, hidden, focusSeries],
  )

  // the horizon (N, T) lives in the timeline, not among the model's parameters
  const shown = (s: ParamSpec) => s.id !== def.horizont && (def.layout?.sichtbar?.[s.id]?.(params) ?? true)
  const specs = def.model.params.filter(shown)
  const all = def.model.params
  const horizonSpec = def.horizont ? all.find((s) => s.id === def.horizont) : undefined
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
  // a parameter pointed at in the formulas lights up its row and its handles
  const [formulaHot, setFormulaHot] = useState<string | null>(null)
  const rowLit = dragged ?? formulaHot
  const handleHot = hotParam ?? formulaHot
  const rootRef = useRef<HTMLElement>(null)
  const focusParam = (id: string) => {
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-param-row="${id}"]`)
    if (!row) return
    const more = row.closest('details')
    if (more && !more.open) more.open = true
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const input = row.querySelector<HTMLElement>('input.ab-val, input, button')
    input?.focus()
  }
  const formeln = typeof def.formeln === 'function' ? def.formeln(params) : def.formeln
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
    <div key={s.id} className="ab-param-wrap" data-param-row={s.id} data-hot={rowLit === s.id || undefined} onPointerEnter={() => setHotParam(s.id)} onPointerLeave={() => setHotParam(null)}>
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
    <section className="ab-applet" aria-label={def.titel} data-applet={def.id} ref={rootRef} onKeyDown={onKey}>
      {kopf && (
        <header className="ab-head">
          <div>
            <h2 className="ab-title">{def.titel}</h2>
            <p className="ab-sub">{def.kurz}</p>
          </div>
          {vollbildHref && (
            <a className="ab-icon" href={vollbildHref} data-tip="Applet auf eigener Seite öffnen" aria-label="Applet auf eigener Seite öffnen">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="M12 3h5v5M17 3l-6 6M8 17H3v-5M3 17l6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </a>
          )}
        </header>
      )}

      <div className="ab-body">
        <div className="ab-stage">
          {formeln && formeln.length > 0 && (
            <FormulaBar
              formeln={formeln}
              specs={all}
              params={params}
              onChange={(id, v) => change(id, v)}
              onHot={setFormulaHot}
              onFocusParam={focusParam}
              hot={hotParam ?? dragged}
            />
          )}
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
                      hotParam={handleHot}
                      onHandle={setDragged}
                      pair={def.plots.length === 2}
                      onToggleSeries={toggleSeries}
                      onFocusSeries={setFocusSeries}
                      vergleich={vergleich ? { run: vergleich.run, text: vergleichText, detail: vergleichDetail } : null}
                      onVergleichLoesen={() => setVergleich(null)}
                      onVergleichen={i === 0 && !vergleich ? () => setVergleich({ params, run }) : undefined}
                      bahnen={startParamOf(entry) ? bahnen : undefined}
                      onBahn={startParamOf(entry) ? (s) => setStarts((l) => [...l, s].slice(-MAX_BAHNEN)) : undefined}
                      onBahnenLoeschen={() => setStarts([])}
                      onDetail={detail}
                    />
                    ),
                  )}
                </div>
              )}
              {timeline && run && clock && (
                <Timeline
                  value={cursor}
                  min={tMin}
                  max={tMax}
                  continuous={!iterative}
                  onChange={setCursor}
                  horizon={
                    horizonSpec && (horizonSpec.kind === 'real' || horizonSpec.kind === 'int')
                      ? {
                          spec: horizonSpec,
                          value: params[horizonSpec.id] as number,
                          onChange: (v) => change(horizonSpec.id, v),
                          message: hints[horizonSpec.id],
                          onInvalid: (m) => setHints((h) => ({ ...h, [horizonSpec.id]: m })),
                        }
                      : undefined
                  }
                />
              )}
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
                <span className="ab-undo" role="group" aria-label="Verlauf">
                  <button type="button" className="ab-tool" onClick={history.undo} disabled={!history.canUndo} data-tip="{Mod} + {Z} | rückgängig" aria-label="rückgängig">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M6 4 2.5 7.5 6 11M3 7.5h6.5a3.5 3.5 0 0 1 0 7H8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button type="button" className="ab-tool" onClick={history.redo} disabled={!history.canRedo} data-tip="{Redo} | wiederholen" aria-label="wiederholen">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M10 4l3.5 3.5L10 11M13 7.5H6.5a3.5 3.5 0 0 0 0 7H8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <CopyLink />
                  <button type="button" className="ab-tool" onClick={reset} data-tip="alle Parameter zurücksetzen" aria-label="alle Parameter zurücksetzen">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M3.5 8a4.5 4.5 0 1 0 1.5-3.4M3.5 2.5v2.7h2.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </span>
              </span>
            </div>
            {def.szenarien && def.szenarien.length > 0 && (
              <div className="ab-szenarien" role="group" aria-label="Szenarien">
                {def.szenarien.map((s) => {
                  const active = Object.entries(s.params).every(([id, v]) => JSON.stringify(params[id]) === JSON.stringify(v))
                  return (
                    <button key={s.label} type="button" className="ab-pill ab-szenario" aria-pressed={active} data-tip={s.text} onClick={() => setParams({ ...defaultParams(def.model), ...s.params })}>
                      <MathLabel text={s.label} />
                    </button>
                  )
                })}
              </div>
            )}
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
                      vorher={vergleich?.run.observables[id]}
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
/** The chips of a readout: one per value. */
function valuesOf(o: Observable, perItem = false): { text: string; item?: number }[] {
  const v = o.value
  if (v === null) return []
  if (o.format) return [{ text: o.format(v) }]
  if (Array.isArray(v)) return (v as readonly (number | string)[]).map((x, item) => ({ text: typeof x === 'string' ? x : valueText(o, x), item: perItem ? item : undefined }))
  if (typeof v === 'number') return [{ text: valueText(o, v) }]
  return [{ text: String(v) }]
}

function Readout({
  o,
  vorher,
  active,
  pinned,
  onSpot,
  onPin,
}: {
  o: Observable
  /** The same readout in the held comparison, if there is one. */
  vorher?: Observable
  active: number | 'all' | null
  pinned: boolean
  onSpot: (item: number | undefined | null) => void
  onPin: () => void
}) {
  const v = o.value
  const missing = v === null || (Array.isArray(v) && v.length === 0)
  const linked = !!o.marks?.length
  const perItem = linked && o.marks!.some((m) => m.item !== undefined)
  const values = valuesOf(o, perItem)
  // the earlier value, when comparing and it differs
  const before = vorher ? valuesOf(vorher).map((x) => x.text).join(', ') || '—' : null
  const changed = before !== null && before !== (values.map((x) => x.text).join(', ') || '—')

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
        {changed && <span className="ab-stat-before">vorher {before}</span>}
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
    <button type="button" className="ab-tool ab-copy" onClick={copy} data-tip="Link zu genau diesem Zustand kopieren" aria-label="Link kopieren" data-done={done || undefined}>
      {done ? (
        <span className="ab-copy-done">kopiert ✓</span>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5l-1.2 1.2a2.5 2.5 0 0 1-3.5-3.5L5.5 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
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
