/**
 * Formula templates. An applet states its model as TeX with parameters in double braces:
 *
 *   'x_{n+1} = {{a}}\\,x_n'            → a live symbol a (or its value, with numbers shown)
 *   'x_{n+1} = x_n {{+b}}'             → "+ b"; with numbers "+ 1" or "− 1": the sign joins the operator
 *   'x_n = {{(a)}}^n\\,{{x0}}'         → parentheses around a negative value, e.g. (−0,5)^n
 *   'x_0 = {{#x0}}'                    → always the value: a start value, where "x₀ = x₀" would say nothing
 *   'y(0) = {{#start}}'                → a point as a column vector, each entry its own chip; {{start.0}} is one entry
 *   '{{a}}{{*}}x'                      → a product: a x with symbols, 0,8 · x with numbers
 *   '{{stoerung}}'                     → a switch or choice shows its state ("an"); a click changes it
 *   '{{#z.0}} {{#+z.1}}\\,i'           → modifiers combine: 3 − 2 i, each part draggable
 *
 * Several equations in one formula are separated by `\\`. Each line is split at its first
 * relation (=, ≤, ∼, …), so all lines of all formulas can be aligned at it.
 *
 * Each placeholder becomes `\htmlData{param=<id>}{…}`, which KaTeX renders as a span with
 * `data-param`: the component makes those spans draggable, focusable and linked.
 */

import { type ParamSpec, type ParamValue, type Params } from '@abacus/applet-core'

export interface Formel {
  /** Short caption at the left of the first line, e.g. "Vorschrift", "Start". */
  label?: string
  /** TeX; lines separated by `\\`. */
  tex: string
}

export type FormulaMode = 'symbole' | 'zahlen'

const PLACEHOLDER = /\{\{\s*([+(#]*)\s*([A-Za-z_][A-Za-z0-9_]*)(?:\.([01]))?\s*\)?\s*\}\}/g

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

const chip = (id: string, body: string, idx?: number) => `\\htmlData{param=${id}${idx === undefined ? '' : `, idx=${idx}`}}{${body}}`

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
    const idx = index === undefined ? undefined : Number(index)
    const signed = mod.includes('+')
    if (mode === 'symbole' && !mod.includes('#')) {
      const sym = idx === undefined ? symbol : `${symbol}_{${idx + 1}}`
      return signed ? `+ ${chip(id, sym, idx)}` : chip(id, sym, idx)
    }
    const value: ParamValue = params[id]
    let v: number
    if (typeof value === 'number') v = value
    else if (Array.isArray(value)) {
      // a point is a column vector; each entry is dragged on its own
      if (idx === undefined) return `\\begin{pmatrix} ${chip(id, texNumber(value[0], 3), 0)} \\\\ ${chip(id, texNumber(value[1], 3), 1)} \\end{pmatrix}`
      v = value[idx]
    } else return chip(id, `\\text{${String(value)}}`)
    const digits = idx === undefined ? 4 : 3
    if (signed) return v < 0 ? `- ${chip(id, texNumber(-v, digits), idx)}` : `+ ${chip(id, texNumber(v, digits), idx)}`
    if (mod.includes('(') && v < 0) return chip(id, `\\left(${texNumber(v, digits)}\\right)`, idx)
    return chip(id, texNumber(v, digits), idx)
  })
}

/** Top-level pieces of TeX, cut where `at` matches outside braces and environments (matrices). */
function splitTop(tex: string, at: (tex: string, i: number) => number): { parts: string[]; cuts: string[] } {
  const parts: string[] = []
  const cuts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i]
    if (c === '\\' && (tex[i + 1] === '{' || tex[i + 1] === '}')) {
      i++ // an escaped brace does not nest
      continue
    }
    if (tex.startsWith('\\begin{', i)) depth++
    else if (tex.startsWith('\\end{', i)) depth--
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (depth === 0) {
      const len = at(tex, i)
      if (len > 0) {
        parts.push(tex.slice(start, i))
        cuts.push(tex.slice(i, i + len))
        start = i + len
        i += len - 1
      }
    }
  }
  parts.push(tex.slice(start))
  return { parts, cuts }
}

/** The lines of a formula (separated by `\\` outside braces). */
export function formulaLines(tex: string): string[] {
  return splitTop(tex, (t, i) => (t.startsWith('\\\\', i) ? 2 : 0))
    .parts.map((l) => l.trim())
    .filter(Boolean)
}

const RELATIONS = ['\\approx', '\\sim', '\\leq', '\\geq', '\\le', '\\ge', '=', '<', '>']

export interface FormulaLine {
  lhs: string
  /** The first relation, e.g. `=`; empty when the line has none. */
  rel: string
  rhs: string
}

/** A line split at its first top-level relation, for alignment in a column. */
export function splitRelation(line: string): FormulaLine {
  let found = false
  const { parts, cuts } = splitTop(line, (t, i) => {
    if (found) return 0
    // a backslash command that merely starts like a relation (\left, \leftarrow) is not one
    const r = RELATIONS.find((rel) => t.startsWith(rel, i) && !(rel.startsWith('\\') && /[A-Za-z]/.test(t[i + rel.length] ?? '')))
    if (!r) return 0
    // "\\" line breaks and "\," spaces are not relations; "=" inside "\ne" etc. never occurs here
    found = true
    return r.length
  })
  if (!cuts.length) return { lhs: '', rel: '', rhs: line.trim() }
  return { lhs: parts[0].trim(), rel: cuts[0], rhs: parts.slice(1).join('').trim() }
}
