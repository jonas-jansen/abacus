/**
 * Parameter schema (spec §4.1).
 *
 * Applets declare parameters in record form — `{ a: real(...), N: int(...) }` — so that
 * the record key is the id and `ParamsOf<D>` gives the model a typed `p.a: number`.
 * Internally (UI, URL codec) the array form `ParamSpec[]` with explicit ids is used.
 */

export type Point = readonly [number, number]
export type ParamValue = number | string | boolean | Point
export type Params = Readonly<Record<string, ParamValue>>

/**
 * Hard limits: only where the applet would actually break (division by zero, a run too long
 * for the browser). Values outside are clamped, and `reason` tells the student why.
 */
export interface Limits {
  min?: number
  max?: number
  reason: string
}

export interface RealParam {
  kind: 'real'
  id: string
  label: string
  latex?: string
  /**
   * The slider's range. A suggestion, not a restriction: typed values may lie outside, and
   * the slider then stretches to include them. Only `limits` restrict.
   */
  min: number
  max: number
  /** Arrow-key increment, not a hard quantisation; typed values may be finer. */
  step: number
  default: number
  limits?: Limits
  /** 'log' for parameters spanning orders of magnitude (min must be > 0). */
  scale?: 'linear' | 'log'
  unit?: string
  /** Fine mode (Feinmodus) allowed. Default true. */
  fine?: boolean
}

export interface IntParam {
  kind: 'int'
  id: string
  label: string
  latex?: string
  /** Slider range — a suggestion, see RealParam. */
  min: number
  max: number
  default: number
  limits?: Limits
}

export interface ChoiceParam<V extends string = string> {
  kind: 'choice'
  id: string
  label: string
  latex?: string
  options: readonly { value: V; label: string }[]
  default: V
}

export interface BoolParam {
  kind: 'bool'
  id: string
  label: string
  latex?: string
  labelOn: string
  labelOff: string
  default: boolean
}

/** A draggable initial condition. */
export interface PointParam {
  kind: 'point'
  id: string
  label: string
  latex?: string
  /** Suggested region; typed values may lie outside. */
  xBounds: Point
  yBounds: Point
  default: Point
}

export type ParamSpec = RealParam | IntParam | ChoiceParam | BoolParam | PointParam

type Def<T> = Omit<T, 'id'>
type Opts<T> = Omit<T, 'id' | 'kind' | 'label'>

export type ParamDef = Def<RealParam> | Def<IntParam> | Def<ChoiceParam> | Def<BoolParam> | Def<PointParam>
export type ParamDefs = Record<string, ParamDef>

export type ValueOf<D> = D extends { kind: 'real' | 'int' }
  ? number
  : D extends { kind: 'choice'; default: infer V }
    ? V
    : D extends { kind: 'bool' }
      ? boolean
      : D extends { kind: 'point' }
        ? Point
        : never

/** The typed parameter object a model receives, derived from its record-form declaration. */
export type ParamsOf<D extends ParamDefs> = { readonly [K in keyof D]: ValueOf<D[K]> }

// ---------------------------------------------------------------------------------------
// Builders

export const real = (label: string, o: Opts<RealParam>): Def<RealParam> => ({ kind: 'real', label, ...o })

export const int = (label: string, o: Opts<IntParam>): Def<IntParam> => ({ kind: 'int', label, ...o })

export function choice<const V extends string>(
  label: string,
  options: readonly { value: V; label: string }[],
  defaultValue: NoInfer<V>,
): Def<ChoiceParam<V>> {
  return { kind: 'choice', label, options, default: defaultValue }
}

export const bool = (label: string, o: Opts<BoolParam>): Def<BoolParam> => ({ kind: 'bool', label, ...o })

export const point = (label: string, o: Opts<PointParam>): Def<PointParam> => ({ kind: 'point', label, ...o })

export const ITERATION_LIMITS: Limits = {
  min: 0,
  max: 1_000_000,
  reason: 'Höchstens eine Million Schritte – mehr kann der Browser nicht flüssig rechnen.',
}

/**
 * The number of iteration steps: slider up to `max`, typed values up to a million.
 * `steps('Schritte N', { default: 25, max: 80 })`
 */
export const steps = (label: string, o: { default: number; max?: number; min?: number; latex?: string }): Def<IntParam> => ({
  kind: 'int',
  label,
  latex: o.latex,
  min: o.min ?? 1,
  max: o.max ?? 100,
  default: o.default,
  limits: ITERATION_LIMITS,
})

// ---------------------------------------------------------------------------------------
// Helpers

export function specsOf(defs: ParamDefs): ParamSpec[] {
  return Object.entries(defs).map(([id, d]) => ({ ...d, id }) as ParamSpec)
}

export function defaultsOf(specs: readonly ParamSpec[]): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const s of specs) out[s.id] = s.default
  return out
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** Parses a number the way a German student types it: "3,45", "3.45", "1e-3", " −2 ". */
export function parseNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw !== 'string') return undefined
  // Thousands separators (spaces, narrow spaces, apostrophes) are ignored: "1 000 000".
  let s = raw.trim().replace(/[\s  ']/g, '').replace(/−/g, '-').replace(',', '.')
  // powers of ten as they are shown: 5·10⁻⁶, 5*10^-6, 5×10^(-6)
  const SUP: Record<string, string> = { '⁻': '-', '⁺': '+', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
  s = s.replace(/[·*×]10(?:\^\(?([-+]?\d+)\)?|([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+))$/, (_m, caret: string | undefined, sup: string | undefined) => `e${caret ?? [...sup!].map((c) => SUP[c]).join('')}`)
  if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return undefined
  const v = Number(s)
  return Number.isFinite(v) ? v : undefined
}

export interface Checked {
  value: ParamValue
  /** Set when the value had to be changed; says why. */
  message?: string
}

function applyLimits(v: number, limits: Limits | undefined): Checked {
  if (!limits) return { value: v }
  if (limits.min !== undefined && v < limits.min) return { value: limits.min, message: limits.reason }
  if (limits.max !== undefined && v > limits.max) return { value: limits.max, message: limits.reason }
  return { value: v }
}

/**
 * Validates an untrusted value (text field, URL, import) against its spec. Only hard limits
 * restrict; the slider range does not. Returns undefined if the value is not interpretable.
 */
export function checkValue(spec: ParamSpec, raw: unknown): Checked | undefined {
  switch (spec.kind) {
    case 'real': {
      const v = parseNumber(raw)
      return v === undefined ? undefined : applyLimits(v, spec.limits)
    }
    case 'int': {
      const v = parseNumber(raw)
      if (v === undefined) return undefined
      const r = applyLimits(Math.round(v), spec.limits)
      return Number.isInteger(v) ? r : { value: r.value, message: r.message ?? 'Nur ganze Zahlen – der Wert wurde gerundet.' }
    }
    case 'choice':
      return spec.options.some((o) => o.value === raw) ? { value: raw as string } : undefined
    case 'bool':
      if (raw === true || raw === 'true' || raw === '1' || raw === 1) return { value: true }
      if (raw === false || raw === 'false' || raw === '0' || raw === 0) return { value: false }
      return undefined
    case 'point': {
      const parts = typeof raw === 'string' ? raw.split(/[;~]/) : Array.isArray(raw) ? raw : null
      if (!parts || parts.length !== 2) return undefined
      const x = parseNumber(parts[0])
      const y = parseNumber(parts[1])
      return x === undefined || y === undefined ? undefined : { value: [x, y] }
    }
  }
}

/** `checkValue` without the explanation. */
export function coerce(spec: ParamSpec, raw: unknown): ParamValue | undefined {
  return checkValue(spec, raw)?.value
}

export function sameValue(a: ParamValue, b: ParamValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a[0] === b[0] && a[1] === b[1]
  return a === b
}
