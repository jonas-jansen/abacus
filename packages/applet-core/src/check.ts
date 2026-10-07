/**
 * Checking and feedback (§8). Checkers return a diagnosis, never a boolean: the student
 * hears "zu klein — bei a = 2.8 läuft die Folge immer noch auf einen Wert zu", not a red cross.
 *
 * Checkers are plain functions in the quiz definitions. They receive the answer and, for
 * questions about an applet, its current parameters and readouts (from the channel).
 */

import type { Observables } from './model'
import { formatNumber } from './format'
import { parseNumber, type Params } from './params'

export interface Diagnosis {
  status: 'correct' | 'close' | 'wrong' | 'saved'
  /** For numbers: which way the answer is off. */
  direction?: 'too small' | 'too large'
  /** Shown to the student (German), may contain $math$. */
  hint?: string
}

export type Checker<P extends Params = Params> = (answer: unknown, p: P, o: Observables) => Diagnosis

/** A hint may depend on the submitted value and the applet state it was submitted in. */
export type HintText<P extends Params = Params> = string | ((value: number, p: P, o: Observables) => string)

const hintOf = <P extends Params>(h: HintText<P> | undefined, v: number, p: P, o: Observables) =>
  typeof h === 'function' ? h(v, p, o) : h

export const NOT_A_NUMBER: Diagnosis = {
  status: 'wrong',
  hint: 'Bitte eine Zahl eingeben, z. B. 3.2.',
}

export interface ThresholdOptions<P extends Params> {
  target: number
  tolerance: number
  /** Within this distance the answer is "close". Default 3 × tolerance. */
  close?: number
  tooSmall?: HintText<P>
  tooLarge?: HintText<P>
  correct?: HintText<P>
}

/** A number against a known target, with the direction it is off. */
export function threshold<P extends Params = Params>(o: ThresholdOptions<P>): Checker<P> {
  const close = o.close ?? 3 * o.tolerance
  return (answer, p, obs) => {
    const v = parseNumber(answer)
    if (v === undefined) return NOT_A_NUMBER
    const d = v - o.target
    if (Math.abs(d) <= o.tolerance) return { status: 'correct', hint: hintOf(o.correct, v, p, obs) }
    return {
      status: Math.abs(d) <= close ? 'close' : 'wrong',
      direction: d < 0 ? 'too small' : 'too large',
      hint: hintOf(d < 0 ? o.tooSmall : o.tooLarge, v, p, obs),
    }
  }
}

export interface ReadOffOptions<P extends Params> {
  /** Readout id to compare against. For `list` readouts any element counts. */
  observable: string
  /** Integers (kind `index`) are always compared exactly. */
  tolerance?: number
  close?: number
  tooSmall?: HintText<P>
  tooLarge?: HintText<P>
}

/** A value read off the applet in its current state. */
export function readOff<P extends Params = Params>(o: ReadOffOptions<P>): Checker<P> {
  return (answer, p, obs) => {
    const v = parseNumber(answer)
    if (v === undefined) return NOT_A_NUMBER
    const target = obs[o.observable]
    if (!target || target.value === null) {
      return {
        status: 'saved',
        hint: target?.note ?? 'In der aktuellen Einstellung lässt sich diese Größe nicht bestimmen.',
      }
    }
    const candidates = Array.isArray(target.value) ? target.value : [target.value]
    const nums = candidates.filter((c): c is number => typeof c === 'number')
    if (nums.length === 0) return { status: 'saved' }
    const best = nums.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))
    const exact = target.kind === 'index'
    const tol = exact ? 0 : (o.tolerance ?? 0)
    const d = v - best
    if (Math.abs(d) <= tol + (exact ? 0 : 1e-12)) return { status: 'correct' }
    const close = exact ? 1 : (o.close ?? 3 * tol)
    return {
      status: Math.abs(d) <= close ? 'close' : 'wrong',
      direction: d < 0 ? 'too small' : 'too large',
      hint: hintOf(d < 0 ? o.tooSmall : o.tooLarge, v, p, obs),
    }
  }
}

/** One of a closed set, against a computed `category` readout. */
export function inCategory<P extends Params = Params>(o: {
  observable: string
  /** A nudge per wrong answer, keyed by the answer given. */
  hints?: Readonly<Record<string, string>>
}): Checker<P> {
  return (answer, _p, obs) => {
    const target = obs[o.observable]?.value
    if (target === null || target === undefined) return { status: 'saved' }
    if (String(answer).trim() === String(target)) return { status: 'correct' }
    return { status: 'wrong', hint: o.hints?.[String(answer).trim()] }
  }
}

/**
 * A condition on parameters and readouts: set the applet until it holds. The predicate may
 * return a full diagnosis to give a directed nudge.
 */
export function condition<P extends Params = Params>(
  pred: (p: P, o: Observables) => boolean | Diagnosis,
  texts: { correct?: string; wrong?: string } = {},
): Checker<P> {
  return (_answer, p, o) => {
    const r = pred(p, o)
    if (typeof r !== 'boolean') return r
    return r ? { status: 'correct', hint: texts.correct } : { status: 'wrong', hint: texts.wrong }
  }
}

/** Formats a number for use inside hint texts (decimal point: 0.5). */
export const numText = (v: number, digits = 4) => formatNumber(v, digits)
