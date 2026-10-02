/**
 * Checking an answer: pure functions, no React, no DOM – the same code can grade on a server
 * later. Answers refer to options by their index in the definition, never by the order shown,
 * so shuffling never changes a grade.
 *
 * Answer shapes:  einfach – number · mehrfach – number[] · zuordnung – (number | null)[]
 * (per left item, the index of the chosen right item in `rechteSeite(def)`) · zahl – number
 * or text · antwort / vorhersage – text.
 */

import { formatNumber, parseNumber, type Diagnose } from '@abacus/applet-core'
import type { QuizDef, ZuordnungQuiz } from './define'

export interface Bewertung {
  status: Diagnose['status']
  /** Points reached; `max` 0 for answers the computer does not grade. */
  punkte: number
  max: number
  hinweis?: string
  richtung?: Diagnose['richtung']
}

/** The types the computer can grade on its own, without an applet. */
export const PRUEFBAR = new Set<QuizDef['typ']>(['einfach', 'mehrfach', 'zuordnung', 'zahl'])

/** All right items of a matching question, in definition order: partners first, then distractors. */
export const rechteSeite = (def: ZuordnungQuiz): string[] => [...def.paare.map((p) => p[1]), ...(def.ablenker ?? [])]

const status = (anteil: number): Diagnose['status'] => (anteil >= 1 - 1e-9 ? 'richtig' : anteil > 0 ? 'nah' : 'falsch')

/** Whether an answer is there at all (an empty answer is graded as wrong, but flagged before submitting). */
export function beantwortet(def: QuizDef, antwort: unknown): boolean {
  switch (def.typ) {
    case 'einfach':
      return typeof antwort === 'number'
    case 'mehrfach':
      return Array.isArray(antwort) && antwort.length > 0
    case 'zuordnung':
      return Array.isArray(antwort) && antwort.some((x) => x !== null && x !== undefined)
    case 'zahl':
      return parseNumber(antwort) !== undefined
    default:
      return typeof antwort === 'string' ? antwort.trim() !== '' : antwort !== undefined && antwort !== null
  }
}

/** Grades an answer to a question that needs no applet. Others are recorded as given. */
export function bewerte(def: QuizDef, antwort: unknown): Bewertung {
  switch (def.typ) {
    case 'einfach': {
      const ok = antwort === def.richtig
      return { status: ok ? 'richtig' : 'falsch', punkte: ok ? 1 : 0, max: 1 }
    }
    case 'mehrfach': {
      // each right choice counts, each wrong choice takes one back; never below 0
      const gewaehlt = new Set(Array.isArray(antwort) ? (antwort as number[]) : [])
      const richtig = new Set(def.richtig)
      let treffer = 0
      let falsch = 0
      for (const i of gewaehlt) (richtig.has(i) ? treffer++ : falsch++)
      const anteil = Math.max(0, (treffer - falsch) / richtig.size)
      const fehlt = richtig.size - treffer
      const hinweis =
        anteil >= 1
          ? undefined
          : [falsch ? `${falsch} gewählte Aussage${falsch > 1 ? 'n' : ''} stimm${falsch > 1 ? 'en' : 't'} nicht` : '', fehlt ? `${fehlt} richtige fehl${fehlt > 1 ? 'en' : 't'}` : '']
              .filter(Boolean)
              .join(', ') + '.'
      return { status: status(anteil), punkte: anteil, max: 1, hinweis }
    }
    case 'zuordnung': {
      const wahl = Array.isArray(antwort) ? (antwort as (number | null)[]) : []
      const n = def.paare.length
      let ok = 0
      for (let i = 0; i < n; i++) if (wahl[i] === i) ok++
      const anteil = ok / n
      return { status: status(anteil), punkte: anteil, max: 1, hinweis: anteil < 1 ? `${ok} von ${n} Zuordnungen stimmen.` : undefined }
    }
    case 'zahl': {
      const v = parseNumber(antwort)
      if (v === undefined) return { status: 'falsch', punkte: 0, max: 1, hinweis: 'Bitte eine Zahl, z. B. 3,2.' }
      const tol = def.toleranz ?? Math.abs(def.ziel) * 5e-7
      const d = v - def.ziel
      if (Math.abs(d) <= tol) return { status: 'richtig', punkte: 1, max: 1 }
      const richtung = d < 0 ? 'zu klein' : 'zu groß'
      return { status: Math.abs(d) <= 3 * Math.max(tol, 1e-12) ? 'nah' : 'falsch', punkte: 0, max: 1, richtung }
    }
    default:
      return { status: 'gespeichert', punkte: 0, max: 0 }
  }
}

/** An answer as readable text: the chosen options' wording, the pairs, the number. */
export function antwortText(def: QuizDef, antwort: unknown): string | undefined {
  switch (def.typ) {
    case 'einfach':
      return typeof antwort === 'number' ? def.optionen[antwort] : undefined
    case 'mehrfach':
      return Array.isArray(antwort) ? (antwort as number[]).map((i) => def.optionen[i]).join('; ') : undefined
    case 'zuordnung': {
      if (!Array.isArray(antwort)) return undefined
      const rechts = rechteSeite(def)
      return def.paare.map(([l], i) => `${l} → ${(antwort as (number | null)[])[i] != null ? rechts[(antwort as number[])[i]] : '–'}`).join('; ')
    }
    default:
      return undefined
  }
}

/** The right answer, as text for the solution view. */
export function richtigeAntwort(def: QuizDef): string | null {
  switch (def.typ) {
    case 'einfach':
      return def.optionen[def.richtig]
    case 'mehrfach':
      return def.richtig.map((i) => def.optionen[i]).join('; ')
    case 'zahl':
      return `${def.groesse ? def.groesse + ' = ' : ''}${formatNumber(def.ziel, 8)}${def.einheit ? ' ' + def.einheit : ''}`
    default:
      return null
  }
}

/**
 * A fixed shuffle for a seed: the same attempt shows the same order after a reload, a new
 * attempt a new one. Returns the indices in display order.
 */
export function mischung(n: number, seed: string): number[] {
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
