/**
 * Checking and feedback (§8). Checkers return a diagnosis, never a boolean: the student
 * hears "zu klein — bei a = 2,8 läuft die Folge immer noch auf einen Wert zu", not a red cross.
 *
 * Checkers are plain functions, so they live in the applet definition and are referenced
 * by name from MDX (`<Finde pruefer="stabilitaetsverlust">`) — props crossing into an
 * island must be serialisable, functions are not.
 */

import type { Observables } from './model'
import { formatNumber } from './format'
import { parseNumber, type Params } from './params'

export interface Diagnose {
  status: 'richtig' | 'nah' | 'falsch' | 'gespeichert'
  richtung?: 'zu klein' | 'zu groß'
  hinweis?: string
}

export type Pruefer<P extends Params = Params> = (eingabe: unknown, p: P, o: Observables) => Diagnose

/** A hint may depend on the submitted value and the applet state it was submitted in. */
export type Hinweis<P extends Params = Params> = string | ((wert: number, p: P, o: Observables) => string)

const hint = <P extends Params>(h: Hinweis<P> | undefined, v: number, p: P, o: Observables) =>
  typeof h === 'function' ? h(v, p, o) : h

export const KEINE_ZAHL: Diagnose = {
  status: 'falsch',
  hinweis: 'Bitte eine Zahl eingeben, z. B. 3,2.',
}

export interface SchwelleOptions<P extends Params> {
  ziel: number
  toleranz: number
  /** Within this distance the answer is "nah". Default 3 × toleranz. */
  nah?: number
  zuKlein?: Hinweis<P>
  zuGross?: Hinweis<P>
  richtig?: Hinweis<P>
}

/** A number in parameter space against a known target (question type "Schwelle"). */
export function schwelle<P extends Params = Params>(o: SchwelleOptions<P>): Pruefer<P> {
  const nah = o.nah ?? 3 * o.toleranz
  return (eingabe, p, obs) => {
    const v = parseNumber(eingabe)
    if (v === undefined) return KEINE_ZAHL
    const d = v - o.ziel
    if (Math.abs(d) <= o.toleranz) return { status: 'richtig', hinweis: hint(o.richtig, v, p, obs) }
    const richtung = d < 0 ? 'zu klein' : 'zu groß'
    return {
      status: Math.abs(d) <= nah ? 'nah' : 'falsch',
      richtung,
      hinweis: hint(d < 0 ? o.zuKlein : o.zuGross, v, p, obs),
    }
  }
}

export interface AblesenOptions<P extends Params> {
  /** Observable id to compare against. For `liste` observables any element counts. */
  observable: string
  /** Integers (kind `index`) are always compared exactly. */
  toleranz?: number
  nah?: number
  zuKlein?: Hinweis<P>
  zuGross?: Hinweis<P>
}

/** A value read off the applet in its current state (question type "Ablesen"). */
export function ablesen<P extends Params = Params>(o: AblesenOptions<P>): Pruefer<P> {
  return (eingabe, p, obs) => {
    const v = parseNumber(eingabe)
    if (v === undefined) return KEINE_ZAHL
    const target = obs[o.observable]
    if (!target || target.value === null) {
      return {
        status: 'gespeichert',
        hinweis: target?.note ?? 'In der aktuellen Einstellung lässt sich diese Größe nicht bestimmen.',
      }
    }
    const candidates = Array.isArray(target.value) ? target.value : [target.value]
    const nums = candidates.filter((c): c is number => typeof c === 'number')
    if (nums.length === 0) return { status: 'gespeichert' }
    const best = nums.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
    const exact = target.kind === 'index'
    const tol = exact ? 0 : (o.toleranz ?? 0)
    const d = v - best
    if (Math.abs(d) <= tol + (exact ? 0 : 1e-12)) return { status: 'richtig' }
    const nah = exact ? 1 : (o.nah ?? 3 * tol)
    return {
      status: Math.abs(d) <= nah ? 'nah' : 'falsch',
      richtung: d < 0 ? 'zu klein' : 'zu groß',
      hinweis: hint(d < 0 ? o.zuKlein : o.zuGross, v, p, obs),
    }
  }
}

/** One of a closed set, against a computed `klasse` observable ("Klassifizieren"). */
export function klassifizieren<P extends Params = Params>(o: {
  observable: string
  /** Nudge per wrong answer, keyed by the answer given. */
  hinweise?: Readonly<Record<string, string>>
}): Pruefer<P> {
  return (eingabe, _p, obs) => {
    const target = obs[o.observable]?.value
    if (target === null || target === undefined) return { status: 'gespeichert' }
    if (String(eingabe).trim() === String(target)) return { status: 'richtig' }
    return { status: 'falsch', hinweis: o.hinweise?.[String(eingabe).trim()] }
  }
}

/**
 * Predicate over parameters and observables ("Erzeuge"): configure the applet until it holds.
 * The predicate may return a full diagnosis to give a directed nudge.
 */
export function bedingung<P extends Params = Params>(
  pred: (p: P, o: Observables) => boolean | Diagnose,
  texte: { richtig?: string; falsch?: string } = {},
): Pruefer<P> {
  return (_eingabe, p, o) => {
    const r = pred(p, o)
    if (typeof r !== 'boolean') return r
    return r ? { status: 'richtig', hinweis: texte.richtig } : { status: 'falsch', hinweis: texte.falsch }
  }
}

/** Formats a number for use inside hint strings. */
export const zahlText = (v: number, digits = 4) => formatNumber(v, digits)
