/**
 * One measurement in the panel: its label and values as typeset chips, a column vector or a
 * set of equations. Pointing at it lights up its marks in the plots; with a held comparison,
 * the earlier value stands beside it.
 */

import { type KeyboardEvent } from 'react'
import { formatNumber, type Observable } from '@abacus/applet-core'
import { texNumber } from './formula'
import { MathLabel } from './MathLabel'
import { TeX } from './TeX'

/** A readout value as TeX, the German way: 0{,}819, -0{,}5 \pm 1\,i, 1{,}4 \cdot 10^{11}. */
function valueTex(o: Observable, x: number | string): string {
  if (typeof x === 'number') return (o.kind === 'index' ? String(x) : texNumber(x, o.digits ?? 4)) + (o.einheit ?? '')
  const SUP: Record<string, string> = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
  return x
    .replace(/± 1 i$/, '± i')
    .replace(/·10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_m, e: string) => `\\cdot 10^{${[...e].map((c) => SUP[c]).join('')}}`)
    .replace(/−/g, '-')
    .replace(/,/g, '{,}')
    .replace(/±/g, '\\pm')
    .replace(/\s*i$/, '\\,i')
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

export function Readout({
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
    if (e.key === 'Enter') {
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
        ) : o.form === 'vektor' && Array.isArray(v) ? (
          <span className="ab-vektor" data-active={active !== null || undefined}>
            <TeX tex={`\\begin{pmatrix} ${(v as readonly (number | string)[]).map((x) => valueTex(o, x)).join(' \\\\ ')} \\end{pmatrix}`} />
          </span>
        ) : o.namen && Array.isArray(v) ? (
          <span className="ab-gleichungen">
            {(v as readonly (number | string)[]).map((x, i) => {
              const item = perItem ? i : undefined
              return (
                <span
                  key={i}
                  className="ab-gleichung"
                  data-active={active === 'all' || (item !== undefined && active === item) || undefined}
                  onPointerEnter={item !== undefined ? () => onSpot(item) : undefined}
                  onPointerLeave={item !== undefined ? () => onSpot(undefined) : undefined}
                >
                  <TeX tex={o.namen![i] ?? ''} />
                  <span className="ab-gleich">=</span>
                  <TeX tex={valueTex(o, x)} />
                </span>
              )
            })}
          </span>
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

