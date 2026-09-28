/**
 * State ↔ URL codec (§4.9). Format: `#<appletId>.<paramId>=<value>&…`, always namespaced by
 * applet id. Only values differing from the page's opening state are written, so prose
 * links stay short: `[dies](#logistic-cobweb.a=2.9)`.
 */

import { coerce, sameValue, type ParamSpec, type ParamValue, type Params } from './params'

const DIGITS = 6

export function formatValue(spec: ParamSpec, v: ParamValue): string {
  switch (spec.kind) {
    case 'real':
      return String(Number((v as number).toPrecision(DIGITS)))
    case 'int':
      return String(Math.round(v as number))
    case 'bool':
      return v ? '1' : '0'
    case 'choice':
      return encodeURIComponent(v as string)
    case 'point': {
      const [x, y] = v as readonly [number, number]
      return `${Number(x.toPrecision(DIGITS))}~${Number(y.toPrecision(DIGITS))}`
    }
  }
}

function entries(hash: string): [string, string][] {
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  if (!h) return []
  return h
    .split('&')
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=')
      return eq < 0 ? [part, ''] : [part.slice(0, eq), part.slice(eq + 1)]
    })
}

/** The values the hash sets for one applet, validated and clamped. Unknown keys are ignored. */
export function decodeApplet(hash: string, appletId: string, specs: readonly ParamSpec[]): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  const prefix = appletId + '.'
  for (const [key, raw] of entries(hash)) {
    if (!key.startsWith(prefix)) continue
    const spec = specs.find((s) => s.id === key.slice(prefix.length))
    if (!spec) continue
    let decoded: string
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      continue
    }
    const v = coerce(spec, decoded)
    if (v !== undefined) out[spec.id] = v
  }
  return out
}

/**
 * Rewrites this applet's entries in `hash`, keeping other applets' entries and any
 * non-state fragment untouched. Returns the new hash without the leading '#'.
 */
export function writeApplet(
  hash: string,
  appletId: string,
  specs: readonly ParamSpec[],
  p: Params,
  base?: Params,
): string {
  const prefix = appletId + '.'
  const kept = entries(hash).filter(([k]) => !k.startsWith(prefix))
  const own: [string, string][] = []
  for (const spec of specs) {
    const v = p[spec.id]
    if (v === undefined) continue
    if (base && base[spec.id] !== undefined && sameValue(base[spec.id], v)) continue
    own.push([prefix + spec.id, formatValue(spec, v)])
  }
  return [...kept, ...own].map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join('&')
}
