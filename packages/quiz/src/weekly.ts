/**
 * A weekly quiz: several questions on the lecture, taken as a whole and submitted together.
 * Every attempt is kept. Each quiz sets its own rules: when it is open, how many attempts,
 * and when the solutions show.
 *
 * The rules are applied in the browser. Without a server they guide students who play fair;
 * they cannot stop someone who changes the clock. Graded use needs the server store
 * (docs/quizzes.md).
 */

import type { QuizDef } from './define'

export type SolutionTiming = 'while-answering' | 'after-submit' | 'after-close'

export interface WeeklyQuiz {
  /** Stable for good: attempts are stored under it; also the address /quiz/<id>. */
  id: string
  title: string
  /** One or two sentences: what it covers. Takes $math$. */
  description?: string
  /** Lecture week, for ordering and the list. */
  week?: number
  /** Opens at this local time, e.g. '2026-10-20T08:00'. Open from the start if omitted. */
  opens?: string
  /** Closes at this local time, e.g. '2026-10-27T23:59'. Never closes if omitted. */
  closes?: string
  /** Number of attempts; unlimited if omitted. */
  attempts?: number
  /**
   * while-answering – each question can be checked while answering (practice);
   * after-submit – results and solutions right after submitting (default);
   * after-close – after submitting only "abgegeben"; results and solutions once `closes` has passed.
   */
  solutions?: SolutionTiming
  /** Which attempt counts in the list: the best (default) or the last. */
  counts?: 'best' | 'last'
  questions: readonly QuizDef[]
  /** Bump when questions change meaning; earlier attempts then belong to the old version. */
  version?: number
}

/** Questions a weekly quiz cannot hold: they need an applet on the page. */
const NEEDS_APPLET = new Set<QuizDef['type']>(['configure'])

export function defineWeeklyQuiz(w: WeeklyQuiz): WeeklyQuiz {
  const fail = (m: string) => {
    throw new Error(`Weekly quiz "${w.id}": ${m}`)
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(w.id)) fail("id: letters, digits, '-' and '_' only.")
  if (!w.questions.length) fail('no questions.')
  const ids = w.questions.map((f) => f.id)
  if (new Set(ids).size !== ids.length) fail('duplicate question ids.')
  for (const f of w.questions) {
    if (NEEDS_APPLET.has(f.type)) fail(`question "${f.id}" needs an applet.`)
    if (f.type === 'find' && f.applet) fail(`question "${f.id}" reads an applet; use type "number" in a weekly quiz.`)
  }
  if (w.opens && Number.isNaN(Date.parse(w.opens))) fail('`opens` is not a date.')
  if (w.closes && Number.isNaN(Date.parse(w.closes))) fail('`closes` is not a date.')
  if (w.opens && w.closes && Date.parse(w.opens) >= Date.parse(w.closes)) fail('`opens` is not before `closes`.')
  if (w.solutions === 'after-close' && !w.closes) fail('"after-close" needs `closes`.')
  if (w.attempts !== undefined && !(Number.isInteger(w.attempts) && w.attempts >= 1)) fail('`attempts` is not a number ≥ 1.')
  return w
}

export type Phase = 'upcoming' | 'open' | 'closed'

/** Where the quiz stands at time `now` (ms). */
export function phase(w: WeeklyQuiz, now: number): Phase {
  if (w.opens && now < Date.parse(w.opens)) return 'upcoming'
  if (w.closes && now > Date.parse(w.closes)) return 'closed'
  return 'open'
}

/** Whether results and solutions of a submitted attempt may be shown at time `now`. */
export function solutionsVisible(w: WeeklyQuiz, now: number): boolean {
  return (w.solutions ?? 'after-submit') !== 'after-close' || phase(w, now) === 'closed'
}

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/**
 * "Mo, 20.10., 08:00 Uhr" – read from the text itself, so the build server (in UTC) and the
 * browser print the same.
 */
export function dateText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso)
  if (!m) return iso
  const [, y, mo, d, h, mi] = m
  const day = DAYS[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()]
  return `${day}, ${d}.${mo}.${h ? `, ${h}:${mi} Uhr` : ''}`
}
