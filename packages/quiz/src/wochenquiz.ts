/**
 * A weekly quiz: several questions on the lecture, taken as a whole and submitted together.
 * Every attempt is kept. Each quiz sets its own rules: when it is open, how many attempts,
 * and when the solutions show.
 *
 * The rules are applied in the browser. Without a server they guide honest students; they
 * cannot stop someone who changes the clock. Graded use needs the server store (docs/quizzes.md).
 */

import type { QuizDef } from './define'

export type Loesungen = 'sofort' | 'nachAbgabe' | 'nachFrist'

export interface Wochenquiz {
  /** Stable for good: attempts are stored under it. */
  id: string
  titel: string
  /** One or two sentences: what it covers. Takes $math$. */
  beschreibung?: string
  /** Lecture week, for ordering and the list. */
  woche?: number
  /** Opens at this local time, e.g. '2026-10-20T08:00'. Open from the start if omitted. */
  ab?: string
  /** Closes at this local time, e.g. '2026-10-27T23:59'. Never closes if omitted. */
  bis?: string
  /** Number of attempts; unlimited if omitted. */
  versuche?: number
  /**
   * sofort – each question can be checked while answering (practice);
   * nachAbgabe – results and solutions right after submitting (default);
   * nachFrist – after submitting only "abgegeben"; results and solutions once `bis` has passed.
   */
  loesungen?: Loesungen
  /** Which attempt counts in the list: the best (default) or the last. */
  wertung?: 'beste' | 'letzte'
  fragen: readonly QuizDef[]
  /** Bump when questions change meaning; earlier attempts then belong to the old version. */
  version?: number
}

/** Questions a weekly quiz cannot hold: they need an applet on the page. */
const NUR_MIT_APPLET = new Set<QuizDef['typ']>(['erzeuge'])

export function defineWochenquiz(w: Wochenquiz): Wochenquiz {
  const fehler = (m: string) => {
    throw new Error(`Wochenquiz "${w.id}": ${m}`)
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(w.id)) fehler("Id: Buchstaben, Ziffern, '-' und '_'.")
  if (!w.fragen.length) fehler('keine Fragen.')
  const ids = w.fragen.map((f) => f.id)
  if (new Set(ids).size !== ids.length) fehler('doppelte Frage-Ids.')
  for (const f of w.fragen) {
    if (NUR_MIT_APPLET.has(f.typ)) fehler(`Frage "${f.id}" braucht ein Applet.`)
    if (f.typ === 'finde' && f.applet) fehler(`Frage "${f.id}" liest ein Applet; im Wochenquiz "zahl" verwenden.`)
  }
  if (w.ab && Number.isNaN(Date.parse(w.ab))) fehler('`ab` ist kein Datum.')
  if (w.bis && Number.isNaN(Date.parse(w.bis))) fehler('`bis` ist kein Datum.')
  if (w.ab && w.bis && Date.parse(w.ab) >= Date.parse(w.bis)) fehler('`ab` liegt nicht vor `bis`.')
  if (w.loesungen === 'nachFrist' && !w.bis) fehler('"nachFrist" braucht `bis`.')
  if (w.versuche !== undefined && !(Number.isInteger(w.versuche) && w.versuche >= 1)) fehler('`versuche` ist keine Zahl ≥ 1.')
  return w
}

export type Phase = 'bald' | 'offen' | 'vorbei'

/** Where the quiz stands at time `jetzt` (ms). */
export function phase(w: Wochenquiz, jetzt: number): Phase {
  if (w.ab && jetzt < Date.parse(w.ab)) return 'bald'
  if (w.bis && jetzt > Date.parse(w.bis)) return 'vorbei'
  return 'offen'
}

/** Whether results and solutions of a submitted attempt may be shown at time `jetzt`. */
export function loesungenSichtbar(w: Wochenquiz, jetzt: number): boolean {
  const l = w.loesungen ?? 'nachAbgabe'
  return l !== 'nachFrist' || phase(w, jetzt) === 'vorbei'
}

const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/**
 * "Mo, 20.10., 08:00 Uhr" – read from the text itself, so the build server (in UTC) and the
 * browser print the same.
 */
export function datumText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso)
  if (!m) return iso
  const [, y, mo, d, h, mi] = m
  const tag = TAGE[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()]
  return `${tag}, ${d}.${mo}.${h ? `, ${h}:${mi} Uhr` : ''}`
}
