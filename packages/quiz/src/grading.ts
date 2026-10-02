/**
 * Grading an answer: pure functions, no React, no DOM – the same code can grade on a server
 * later. Answers refer to options by their index in the definition, never by the order shown,
 * so shuffling never changes a grade.
 *
 * Answer shapes:  single – number · multiple – number[] · match – (number | null)[] (per
 * left item, the index of the chosen right item in `rightItems(def)`) · number – number or
 * text · open / prediction – text.
 */

import { formatNumber, parseNumber, type Diagnosis } from '@abacus/applet-core'
import type { Content, MatchQuiz, QuizDef } from './define'

export interface Grade {
  status: Diagnosis['status']
  /** Points reached; `max` 0 for answers the computer does not grade. */
  points: number
  max: number
  hint?: string
  direction?: Diagnosis['direction']
}

/** The types the computer grades on its own, without an applet. */
export const AUTO_GRADED = new Set<QuizDef['type']>(['single', 'multiple', 'match', 'number'])

/** All right items of a matching question, in definition order: partners first, then distractors. */
export const rightItems = (def: MatchQuiz): Content[] => [...def.pairs.map((p) => p[1]), ...(def.distractors ?? [])]

const statusOf = (share: number): Diagnosis['status'] => (share >= 1 - 1e-9 ? 'correct' : share > 0 ? 'close' : 'wrong')

/** Whether there is an answer at all (an empty one is graded as wrong, but flagged before submitting). */
export function isAnswered(def: QuizDef, answer: unknown): boolean {
  switch (def.type) {
    case 'single':
      return typeof answer === 'number'
    case 'multiple':
      return Array.isArray(answer) && answer.length > 0
    case 'match':
      return Array.isArray(answer) && answer.some((x) => x !== null && x !== undefined)
    case 'number':
      return parseNumber(answer) !== undefined
    default:
      return typeof answer === 'string' ? answer.trim() !== '' : answer !== undefined && answer !== null
  }
}

/** Grades an answer to a question that needs no applet. Others are recorded as given. */
export function grade(def: QuizDef, answer: unknown): Grade {
  switch (def.type) {
    case 'single': {
      const ok = answer === def.correct
      return { status: ok ? 'correct' : 'wrong', points: ok ? 1 : 0, max: 1 }
    }
    case 'multiple': {
      // each right choice counts, each wrong choice takes one back; never below 0
      const chosen = new Set(Array.isArray(answer) ? (answer as number[]) : [])
      const right = new Set(def.correct)
      let hits = 0
      let misses = 0
      for (const i of chosen) (right.has(i) ? hits++ : misses++)
      const share = Math.max(0, (hits - misses) / right.size)
      const missing = right.size - hits
      const hint =
        share >= 1
          ? undefined
          : [misses ? `${misses} gewählte Aussage${misses > 1 ? 'n' : ''} stimm${misses > 1 ? 'en' : 't'} nicht` : '', missing ? `${missing} richtige fehl${missing > 1 ? 'en' : 't'}` : '']
              .filter(Boolean)
              .join(', ') + '.'
      return { status: statusOf(share), points: share, max: 1, hint }
    }
    case 'match': {
      const chosen = Array.isArray(answer) ? (answer as (number | null)[]) : []
      const n = def.pairs.length
      let ok = 0
      for (let i = 0; i < n; i++) if (chosen[i] === i) ok++
      const share = ok / n
      return { status: statusOf(share), points: share, max: 1, hint: share < 1 ? `${ok} von ${n} Zuordnungen stimmen.` : undefined }
    }
    case 'number': {
      const v = parseNumber(answer)
      if (v === undefined) return { status: 'wrong', points: 0, max: 1, hint: 'Bitte eine Zahl, z. B. 3,2.' }
      const tol = def.tolerance ?? Math.abs(def.target) * 5e-7
      const d = v - def.target
      if (Math.abs(d) <= tol) return { status: 'correct', points: 1, max: 1 }
      return { status: Math.abs(d) <= 3 * Math.max(tol, 1e-12) ? 'close' : 'wrong', points: 0, max: 1, direction: d < 0 ? 'too small' : 'too large' }
    }
    default:
      return { status: 'saved', points: 0, max: 0 }
  }
}

/** A piece of content as text (pictures by their description). */
const contentText = (c: Content): string => (typeof c === 'string' ? c : (c.alt ?? 'Bild'))

/** An answer as readable text for the notebook: the chosen options, the pairs, the number. */
export function answerText(def: QuizDef, answer: unknown): string | undefined {
  switch (def.type) {
    case 'single':
      return typeof answer === 'number' ? contentText(def.options[answer]) : undefined
    case 'multiple':
      return Array.isArray(answer) ? (answer as number[]).map((i) => contentText(def.options[i])).join('; ') : undefined
    case 'match': {
      if (!Array.isArray(answer)) return undefined
      const right = rightItems(def)
      const chosen = answer as (number | null)[]
      return def.pairs.map(([l], i) => `${contentText(l)} → ${chosen[i] != null ? contentText(right[chosen[i]!]) : '–'}`).join('; ')
    }
    default:
      return undefined
  }
}

/** The right answer as text, for the solution of number and choice questions. */
export function correctAnswer(def: QuizDef): string | null {
  switch (def.type) {
    case 'single':
      return contentText(def.options[def.correct])
    case 'multiple':
      return def.correct.map((i) => contentText(def.options[i])).join('; ')
    case 'number':
      return `${def.quantity ? def.quantity + ' = ' : ''}${formatNumber(def.target, 8)}${def.unit ? ' ' + def.unit : ''}`
    default:
      return null
  }
}

/**
 * A fixed shuffle for a seed: the same attempt shows the same order after a reload, a new
 * attempt a new one. Returns the indices in display order.
 */
export function shuffleOrder(n: number, seed: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  const out = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
