/**
 * Registry of the weekly quizzes: the code (the files below) joined with the catalog
 * (../../quizzes.json: listed or not, one entry per quiz, edited by hand). Ordered by week.
 */

import type { WeeklyQuiz } from '@abacus/quiz/define'
import catalog from '../../quizzes.json'
import vorkurs from './vorkurs'
import week01 from './week-01'
import week02 from './week-02'
import week03 from './week-03'

const modules: WeeklyQuiz[] = [vorkurs, week01, week02, week03]

export interface WeeklyCatalogEntry {
  id: string
  visible: boolean
}

/** The catalog joined with the code; a mismatch fails loudly, naming what to fix. */
export function connectWeekly(entries: readonly WeeklyCatalogEntry[], mods: readonly WeeklyQuiz[]): WeeklyQuiz[] {
  const code = new Map(mods.map((m) => [m.id, m]))
  const errors: string[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    if (seen.has(e.id)) errors.push(`"${e.id}" appears twice in quizzes.json.`)
    seen.add(e.id)
    if (!code.has(e.id)) errors.push(`"${e.id}" is in quizzes.json, but there is no weekly quiz with this id.`)
    if (typeof e.visible !== 'boolean') errors.push(`"${e.id}": visible must be true or false.`)
  }
  for (const m of mods) if (!seen.has(m.id)) errors.push(`The weekly quiz "${m.id}" is missing in quizzes.json.`)
  if (errors.length) throw new Error(`packages/quizzes/quizzes.json:\n  ${errors.join('\n  ')}`)
  return entries.map((e) => ({ ...code.get(e.id)!, visible: e.visible })).sort((a, b) => (a.week ?? 0) - (b.week ?? 0))
}

/** All weekly quizzes, listed or not (every one gets its page). */
export const weeklyQuizzes: readonly WeeklyQuiz[] = connectWeekly(catalog.weekly, modules)

/** The quizzes for the list and the start page: the visible ones, or all with `all`. */
export const listedWeeklyQuizzes = ({ all = false } = {}): WeeklyQuiz[] => weeklyQuizzes.filter((w) => all || w.visible !== false)

export function getWeeklyQuiz(id: string): WeeklyQuiz {
  const w = weeklyQuizzes.find((q) => q.id === id)
  if (!w) throw new Error(`Unknown weekly quiz "${id}".`)
  return w
}
