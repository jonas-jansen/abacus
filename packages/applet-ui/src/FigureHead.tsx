/** The row above a figure: title, compare, zoom reset, trajectories, legend and lin/log switch. */

import { useEffect, useRef, useState } from 'react'
import { type Run, type Series } from '@abacus/applet-core'
import { nullclineSeries, roleStyles, type PlotSpec } from '@abacus/applet-plot'
import { MathLabel } from './MathLabel'
import { TeX } from './TeX'

const LOG_HILFE =
  'Auf einer logarithmischen Achse bedeuten gleiche Abstände gleiche Faktoren: von 1 bis 0,1 ist es so weit wie von 0,1 bis 0,01. So sind sehr große und sehr kleine Werte zugleich zu sehen. Eine Gerade heißt: der Wert ändert sich in jedem Schritt um denselben Faktor. Null und negative Werte haben auf dieser Achse keinen Platz.'

/**
 * The row above a plot: title, legend and axis switch. Every figure has it, so figures side
 * by side keep their plots at the same height. Legend entries are buttons: pointing at one
 * lets the others step back, a click switches the series off (and on) in every plot.
 */
export function FigureHead({
  title,
  legend,
  hidden,
  onToggle,
  onFocus,
  log,
  vergleich,
  onVergleichen,
  bahnen,
  zoomReset,
}: {
  title?: string
  legend: Series[]
  hidden?: ReadonlySet<string>
  onToggle?: (id: string) => void
  onFocus?: (id: string | null) => void
  log?: { on: boolean; set: (on: boolean) => void; hilfe?: string }
  vergleich?: { text: string; loesen?: () => void }
  onVergleichen?: () => void
  bahnen?: { n: number; loeschen?: () => void }
  zoomReset?: () => void
}) {
  const [help, setHelp] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!help) return
    const close = (e: PointerEvent) => {
      if (!helpRef.current?.contains(e.target as Node)) setHelp(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setHelp(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [help])

  return (
    <div className="ab-fighead">
      {title && <span className="ab-figtitle">{title}</span>}
      {onVergleichen && (
        <button type="button" className="ab-pill" onClick={onVergleichen} data-tip="den jetzigen Zustand festhalten – dann etwas ändern und vergleichen">
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M5.5 2.5h5l-1 4 2.5 2.5h-9L5.5 6.5zM8 9v4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          vergleichen
        </button>
      )}
      {zoomReset && (
        <button type="button" className="ab-pill" onClick={zoomReset} data-tip={bahnen ? 'zurück zum ganzen Bild' : '{Doppelklick} | zurück zum ganzen Bild'}>
          Ausschnitt zurücksetzen
        </button>
      )}
      {bahnen &&
        (bahnen.n > 0 ? (
          <button type="button" className="ab-pill" onClick={bahnen.loeschen} data-tip="die zusätzlichen Bahnen entfernen">
            {bahnen.n === 1 ? '1 Bahn' : `${bahnen.n} Bahnen`} löschen
          </button>
        ) : (
          <span className="ab-fig-hint">klicken: weitere Bahn</span>
        ))}
      {vergleich && (
        <button type="button" className="ab-legend-item ab-legend-ghost" onClick={vergleich.loesen} data-tip="Vergleich lösen">
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="21" y2="5" stroke="var(--ab-muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
          </svg>
          <MathLabel text={vergleich.text} />
          <span className="ab-legend-x" aria-hidden="true">
            ×
          </span>
        </button>
      )}
      {(legend.length > 1 || legend.some((s) => s.name)) && (
        <div className="ab-legend" role="group" aria-label="Legende: zeigen oder ausblenden" onPointerLeave={() => onFocus?.(null)}>
          {legend.map((s) => {
            const off = hidden?.has(s.id) ?? false
            return (
              <button
                key={s.id}
                type="button"
                className="ab-legend-item"
                aria-pressed={!off}
                data-tip={off ? 'wieder zeigen' : 'ausblenden'}
                onClick={() => onToggle?.(s.id)}
                onPointerEnter={() => !off && onFocus?.(s.id)}
                onFocus={() => !off && onFocus?.(s.id)}
                onBlur={() => onFocus?.(null)}
              >
                <svg width="22" height="10" aria-hidden="true">
                  {s.fill ? (
                    <rect x="4" y="0.5" width="14" height="9" rx="2" fill={`var(--abacus-${s.role})`} fillOpacity="0.25" stroke={`var(--abacus-${s.role})`} />
                  ) : s.kind === 'discrete' && s.connect === false ? (
                    <circle cx="11" cy="5" r="3.5" fill={`var(--abacus-${s.role})`} />
                  ) : (
                    <line
                      x1="1"
                      y1="5"
                      x2="21"
                      y2="5"
                      stroke={`var(--abacus-${s.role})`}
                      strokeWidth={roleStyles[s.role].width + 0.5}
                      strokeDasharray={(s.dash ?? roleStyles[s.role].dash).join(' ') || undefined}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <TeX tex={s.label} />
                {s.name && <span className="ab-legend-name">{s.name}</span>}
              </button>
            )
          })}
        </div>
      )}
      {log && (
        <div className="ab-axis-switch" ref={helpRef}>
          <div className="ab-seg" role="group" aria-label="y-Achse">
            <button type="button" aria-pressed={!log.on} onClick={() => log.set(false)} data-tip="lineare Achse">
              linear
            </button>
            <button type="button" aria-pressed={log.on} onClick={() => log.set(true)} data-tip="logarithmische Achse">
              log
            </button>
          </div>
          <button type="button" className="ab-help-btn" aria-expanded={help} aria-label="Was ist eine logarithmische Achse?" onClick={() => setHelp(!help)}>
            ?
          </button>
          {help && (
            <div className="ab-help" role="note">
              <strong>Logarithmische Achse</strong>
              <p>{LOG_HILFE}</p>
              {log.hilfe && (
                <p>
                  <MathLabel text={log.hilfe} />
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Series shown in a plot that deserve a legend entry (time series and function graphs). */
export function legendEntries(spec: PlotSpec, run: Run) {
  if (spec.type === 'phasePlane') return nullclineSeries(spec)
  if (spec.legend === false || spec.type === 'cobweb' || spec.type === 'surface3d') return []
  const ids = spec.series
  // annotations (brackets, arrows) explain themselves where they are drawn
  return (ids ? run.series.filter((s) => ids.includes(s.id)) : run.series).filter((s) => s.role !== 'annotation')
}
