/**
 * Formula templates. An applet states its model as TeX with parameters in double braces:
 *
 *   'x_{n+1} = {{a}}\\,x_n'            → a live symbol a (or its value, with numbers shown)
 *   'x_{n+1} = x_n {{+b}}'             → "+ b"; with numbers "+ 1" or "− 1": the sign joins the operator
 *   'x_n = {{(a)}}^n\\,{{x0}}'         → parentheses around a negative value, e.g. (−0,5)^n
 *   'y(0) = {{start}}'                 → a point as (y₁; y₂); {{start.0}} is its first coordinate
 *   '{{a}}{{*}}x'                      → a product: a x with symbols, 0,8 · x with numbers
 *   '{{stoerung}}'                     → a switch or choice shows its state ("an"); a click changes it
 *
 * Each placeholder becomes `\htmlData{param=<id>}{…}`, which KaTeX renders as a span with
 * `data-param`: the component makes those spans draggable, focusable and linked.
 */

import { type ParamSpec, type ParamValue, type Params } from '@abacus/applet-core'

export interface Formel {
  /** Short caption above the formula, e.g. "Vorschrift", "Lösung". */
  label?: string
  tex: string
}

export type FormulaMode = 'symbole' | 'zahlen'

const PLACEHOLDER = /\{\{\s*([+(]?)\s*([A-Za-z_][A-Za-z0-9_]*)(?:\.([01]))?\s*\)?\s*\}\}/g

/** A number as TeX, German style: 0{,}8 · −1{,}25 · 1{,}2 \cdot 10^{-6}. */
export function texNumber(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return v > 0 ? '\\infty' : v < 0 ? '-\\infty' : '\\text{—}'
  if (v === 0) return '0'
  const abs = Math.abs(v)
  const comma = (s: string) => s.replace('.', '{,}')
  if (abs >= 1e5 || abs < 1e-3) {
    const [m, e] = v.toExponential(digits - 1).split('e')
    return `${comma(String(Number(m)))} \\cdot 10^{${Number(e)}}`
  }
  const s = String(Number(v.toPrecision(digits)))
  // group thousands from five digits on, as elsewhere
  const [int, frac] = s.replace('-', '').split('.')
  const grouped = int.length >= 5 ? int.replace(/\B(?=(\d{3})+$)/g, '\\,') : int
  return (v < 0 ? '-' : '') + grouped + (frac ? `{,}${frac}` : '')
}

const chip = (id: string, body: string) => `\\htmlData{param=${id}}{${body}}`

/** Expands the placeholders of a template for one display mode. Unknown ids are left as they are. */
export function expandFormula(tex: string, specs: readonly ParamSpec[], params: Params, mode: FormulaMode): string {
  // juxtaposition reads as a product between symbols, not between numbers: 0,8 5
  return tex.replaceAll('{{*}}', mode === 'symbole' ? '\\,' : ' \\cdot ').replace(PLACEHOLDER, (whole, mod: string, id: string, index?: string) => {
    const spec = specs.find((s) => s.id === id)
    if (!spec) return whole
    // switches and choices show their state in both modes; a click changes it
    if (spec.kind === 'bool') return chip(id, `\\text{${params[id] ? spec.labelOn : spec.labelOff}}`)
    if (spec.kind === 'choice') return chip(id, `\\text{${spec.options.find((o) => o.value === params[id])?.label ?? String(params[id])}}`)
    const symbol = 'latex' in spec && spec.latex ? spec.latex : `\\text{${spec.label}}`
    if (mode === 'symbole') {
      const sym = index === undefined ? symbol : `${symbol}_{${Number(index) + 1}}`
      return mod === '+' ? `+ ${chip(id, sym)}` : chip(id, sym)
    }
    const value: ParamValue = params[id]
    let v: number | null = null
    if (typeof value === 'number') v = value
    else if (Array.isArray(value)) {
      if (index !== undefined) v = value[Number(index)]
      else return chip(id, `(${texNumber(value[0], 3)};\\,${texNumber(value[1], 3)})`)
    } else return chip(id, `\\text{${String(value)}}`)
    if (v === null) return whole
    if (mod === '+') return v < 0 ? `- ${chip(id, texNumber(-v))}` : `+ ${chip(id, texNumber(v))}`
    if (mod === '(' && v < 0) return chip(id, `\\left(${texNumber(v)}\\right)`)
    return chip(id, texNumber(v))
  })
}
