/** Around a figure: its head (title, axis switch), its legend below, and actions in its corner. */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatNumber, type Run, type Series } from '@abacus/applet-core'
import { nullclineSeries, roleStyles, type PlotSpec } from '@abacus/applet-plot'
import { MathLabel } from './MathLabel'
import { TeX } from './TeX'

const LOG_HILFE =
  'Auf einer logarithmischen Achse bedeuten gleiche Abstände gleiche Faktoren: von 1 bis 0,1 ist es so weit wie von 0,1 bis 0,01. So sind sehr große und sehr kleine Werte zugleich zu sehen. Eine Gerade heißt: der Wert ändert sich in jedem Schritt um denselben Faktor. Null und negative Werte haben auf dieser Achse keinen Platz.'

/**
 * The row above a plot: its title and, where offered, the lin/log switch – nothing else, so it
 * reads at a glance. Every figure has it, so figures side by side keep their plots level.
 */
export function FigureHead({
  title,
  log,
}: {
  title?: string
  log?: { on: boolean; set: (on: boolean) => void; hilfe?: string }
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

  // nothing to say above the plot: no empty row (plots side by side stay level at the bottom)
  if (!title && !log) return null
  return (
    <div className="ab-fighead">
      {title && <span className="ab-figtitle">{title}</span>}
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

/**
 * Below a plot: what its lines and colours mean. Entries are buttons: pointing at one lets the
 * others step back, a click switches the series off (and on) in every plot. The held state
 * of "vergleichen" is listed here too, with its own × to let go of it.
 */
export function FigureLegend({
  legend,
  hidden,
  onToggle,
  onFocus,
  vergleich,
  farbskala,
  hinweis,
}: {
  legend: Series[]
  hidden?: ReadonlySet<string>
  onToggle?: (id: string) => void
  onFocus?: (id: string | null) => void
  vergleich?: { text: string; loesen?: () => void }
  /** A heat map's colour scale: what the colour means, from lo to hi. */
  farbskala?: { label: string; lo: number; hi: number }
  /** A quiet line on what the plot does when clicked, e.g. "klicken: weitere Bahn". */
  hinweis?: string
}) {
  const zeigen = legend.length > 1 || legend.some((s) => s.name)
  if (!zeigen && !vergleich && !farbskala && !hinweis) return null
  return (
    <div className="ab-figlegend">
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
      {farbskala && (
        <span className="ab-farbskala">
          <TeX tex={farbskala.label} />
          <span className="ab-farbskala-zahl">{formatNumber(farbskala.lo, 3)}</span>
          <span className="ab-farbskala-bar" aria-hidden="true" />
          <span className="ab-farbskala-zahl">{formatNumber(farbskala.hi, 3)}</span>
        </span>
      )}
      {zeigen && (
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
      {hinweis && <span className="ab-fig-hint">{hinweis}</span>}
    </div>
  )
}

/** Actions that belong to one plot and only exist sometimes: shown in the plot's corner. */
export function FigureActions({
  zoomReset,
  bahnen,
  style,
}: {
  zoomReset?: () => void
  bahnen?: { n: number; loeschen?: () => void }
  style?: CSSProperties
}) {
  if (!zoomReset && !(bahnen && bahnen.n > 0)) return null
  return (
    <div className="ab-figactions" style={style}>
      {zoomReset && (
        <button type="button" className="ab-pill ab-pill-small" onClick={zoomReset} data-tip={bahnen ? 'zurück zum ganzen Bild' : '{Doppelklick} | zurück zum ganzen Bild'}>
          ganzes Bild
        </button>
      )}
      {bahnen && bahnen.n > 0 && (
        <button type="button" className="ab-pill ab-pill-small" onClick={bahnen.loeschen} data-tip="die zusätzlichen Bahnen entfernen">
          {bahnen.n === 1 ? '1 Bahn' : `${bahnen.n} Bahnen`} löschen
        </button>
      )}
    </div>
  )
}

/** Series shown in a plot that deserve a legend entry (time series and function graphs). */
export function legendEntries(spec: PlotSpec, run: Run) {
  if (spec.type === 'phasePlane') return nullclineSeries(spec)
  if (spec.legend === false || spec.type === 'cobweb' || spec.type === 'surface3d' || spec.type === 'heatmap') return []
  if (spec.type === 'bars' && spec.grid) return []
  const ids = spec.series
  // annotations (brackets, arrows) explain themselves where they are drawn
  return (ids ? run.series.filter((s) => ids.includes(s.id)) : run.series).filter((s) => s.role !== 'annotation' && s.legend !== false)
}
