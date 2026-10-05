import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { decimalsOf, defaultParams, explainChange, formatNumber, roundTo, updateParams, type Detail, type Run, type Params, type ParamSpec, type ParamValue } from '@abacus/applet-core'
import { subscribe } from '@abacus/channel'
import { ParamControl } from './controls'
import { handlesOf, type AppletDef, type PlotEntry } from './define'
import { Figure } from './Figure'
import { Figure3D, type Spec3D } from './Figure3D'
import { FormulaBar } from './FormulaBar'
import { MathLabel } from './MathLabel'
import { useAppletState } from './useAppletState'
import { installTips } from './tip'
import { useHistory } from './useHistory'
import { Readout } from './Readout'
import { Timeline } from './Timeline'
import { CopyLink, HilfeKnopf, QrKnopf, useVortrag, VortragKnopf } from './Werkzeuge'

export interface AppletViewProps<P extends Params> {
  def: AppletDef<P>
  /** Opening parameters. */
  initialState?: Readonly<Record<string, unknown>>
  /** Hide the plots until an `applet/unlock` message arrives (e.g. from a prediction quiz). */
  startLocked?: boolean
  /** Text on the locked panel. */
  lockedText?: string
  /** Show title and description. Off when the surrounding page already does. */
  showHeader?: boolean
  /** Link to the applet's own page, shown as an icon in the header. */
  pageHref?: string
}

/** A readout (or one entry of it) the student points at: its marks light up in the plots. */
interface Spot {
  id: string
  item?: number
}

export function AppletView<P extends Params>({ def, initialState, startLocked = false, lockedText, showHeader = true, pageHref }: AppletViewProps<P>) {
  const { params, setParams, reset: resetParams, run, error } = useAppletState(def, initialState)
  // reset and scenarios let the plots fit their axes afresh; other changes keep them (holdRange)
  const [viewEpoch, setViewEpoch] = useState(0)
  // plots over the same time axis share their x window (zoom one, the other follows)
  const [sharedX, setSharedX] = useState<readonly [number, number] | null>(null)
  const isTime = (e: PlotEntry<P>) => e.type === 'timeSeriesDiscrete' || e.type === 'timeSeriesContinuous'
  const linkX = def.plots.filter(isTime).length >= 2
  const reset = () => {
    resetParams()
    setViewEpoch((e) => e + 1)
    setSharedX(null)
  }
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
      .filter((s) => s.id !== def.horizon && JSON.stringify(vergleich.params[s.id]) !== JSON.stringify(params[s.id]))
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
  const [locked, setLocked] = useState(startLocked)
  useEffect(() => (startLocked ? subscribe('applet/unlock', () => setLocked(false), { id: def.id }) : undefined), [startLocked, def.id])

  // The timeline: steps n for iterations, time t for continuous models.
  // steps for iterations and for sequences given by a formula; time otherwise
  const iterative = def.model.kind === 'iteration' || run?.series[0]?.kind === 'discrete'
  const timeline = def.timeline ?? def.model.kind !== 'closedForm'
  const clock = run?.series.find((s) => s.kind === (iterative ? 'discrete' : 'continuous'))
  const [tMin, tMax] = clock?.x.length ? [clock.x[0], clock.x[clock.x.length - 1]] : [0, 0]
  const [cursor, setCursor] = useState<number | undefined>(def.stepwise ? 0 : undefined)
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
  const shown = (s: ParamSpec) => s.id !== def.horizon && (def.layout?.visible?.[s.id]?.(params) ?? true)
  const specs = def.model.params.filter(shown)
  const all = def.model.params
  const horizonSpec = def.horizon ? all.find((s) => s.id === def.horizon) : undefined
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
  const vortrag = useVortrag(rootRef)
  const focusParam = (id: string) => {
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-param-row="${id}"]`)
    if (!row) return
    const more = row.closest('details')
    if (more && !more.open) more.open = true
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const input = row.querySelector<HTMLElement>('input.ab-val, input, button')
    input?.focus()
  }
  const formulas = typeof def.formulas === 'function' ? def.formulas(params) : def.formulas
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
    <section
      className="ab-applet"
      aria-label={def.title}
      data-applet={def.id}
      ref={rootRef}
      onKeyDown={onKey}
      data-vortrag={vortrag.an || undefined}
      style={vortrag.an ? ({ '--ab-vortrag': vortrag.zoom } as CSSProperties) : undefined}
    >
      {(showHeader || vortrag.an) && (
        <header className="ab-head">
          <div>
            <h2 className="ab-title">{def.title}</h2>
            <p className="ab-sub">{def.summary}</p>
          </div>
          {vortrag.an ? (
            <button type="button" className="ab-icon" onClick={vortrag.ende} data-tip="{Esc} | Vortrag beenden" aria-label="Vortrag beenden">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          ) : pageHref && (
            <a className="ab-icon" href={pageHref} data-tip="Applet auf eigener Seite öffnen" aria-label="Applet auf eigener Seite öffnen">
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="M12 3h5v5M17 3l-6 6M8 17H3v-5M3 17l6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </a>
          )}
        </header>
      )}

      <div className="ab-body">
        <div className="ab-stage">
          {formulas && formulas.length > 0 && (
            <FormulaBar
              formulas={formulas}
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
              <p> {lockedText ?? 'Erst vorhersagen, dann nachsehen.'}</p>
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
                      bahnen={startParamOf(entry) ? bahnen : undefined}
                      onBahn={startParamOf(entry) ? (s) => setStarts((l) => [...l, s].slice(-MAX_BAHNEN)) : undefined}
                      onBahnenLoeschen={() => setStarts([])}
                      onDetail={detail}
                      viewEpoch={viewEpoch}
                      xLink={linkX && isTime(entry) ? { x: sharedX, set: setSharedX } : undefined}
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
          {/* tools for the whole applet: history, then compare, link, reset */}
          <div className="ab-toolbar" role="toolbar" aria-label="Werkzeuge">
                <span className="ab-undo" role="group" aria-label="Parameter: Verlauf und zurücksetzen">
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
                  <button type="button" className="ab-tool" onClick={reset} data-tip="alle Parameter zurücksetzen" aria-label="alle Parameter zurücksetzen">
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M3.5 8a4.5 4.5 0 1 0 1.5-3.4M3.5 2.5v2.7h2.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </span>
                <span className="ab-aktionen" role="group" aria-label="Werkzeuge">
                  <button
                    type="button"
                    className="ab-tool"
                    aria-pressed={!!vergleich}
                    disabled={!run}
                    onClick={() => setVergleich(vergleich ? null : run ? { params, run } : null)}
                    data-tip={vergleich ? 'Vergleich lösen' : 'vergleichen: den jetzigen Zustand festhalten, dann etwas ändern'}
                    aria-label={vergleich ? 'Vergleich lösen' : 'vergleichen'}
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M5.5 2.5h5l-1 4 2.5 2.5h-9L5.5 6.5zM8 9v4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                  </button>
                  <CopyLink />
                  <QrKnopf />
                </span>
                <span className="ab-aktionen" role="group" aria-label="Vortrag und Bedienung">
                  <VortragKnopf an={vortrag.an} onClick={vortrag.an ? vortrag.ende : vortrag.start} />
                  <HilfeKnopf bahnen={!!bahnParam} timeline={!!timeline} />
                </span>
          </div>
          {def.scenarios && def.scenarios.length > 0 && (
            <div className="ab-panel-section">
              <h3 className="ab-section-title">Szenarien</h3>
              <div className="ab-szenarien" role="group" aria-label="Szenarien">
                {def.scenarios.map((s) => {
                  const target: Record<string, unknown> = { ...defaultParams(def.model), ...s.params }
                  const active = Object.entries(target).every(([id, v]) => id === def.horizon || JSON.stringify(params[id]) === JSON.stringify(v))
                  return (
                    <button key={s.label} type="button" className="ab-pill ab-szenario" aria-pressed={active} data-tip={s.text} onClick={() => {
                      setParams({ ...defaultParams(def.model), ...s.params })
                      setViewEpoch((e) => e + 1)
                    }}>
                      <MathLabel text={s.label} />
                    </button>
                  )
                })}
              </div>
                        </div>
          )}
          <div className="ab-panel-section">
            <h3 className="ab-section-title">Parameter</h3>
            <div className="ab-controls">{primary.map(control)}</div>
            {more.length > 0 && (
              <details className="ab-more">
                <summary>weitere Parameter ({more.length})</summary>
                <div className="ab-controls">{more.map(control)}</div>
              </details>
            )}
            {def.model.constraintNote && <p className="ab-note">Es gilt: {def.model.constraintNote}.</p>}
          </div>
          {run && !locked && def.readouts && def.readouts.length > 0 && (
            <div className="ab-panel-section">
              <h3 className="ab-section-title">Messwerte</h3>
              <dl className="ab-stats" onPointerLeave={() => setHover(null)}>
                {def.readouts.map((id) => {
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
