/** Registry of the weekly quizzes, in order of the lecture weeks. */

import type { WeeklyQuiz } from '@abacus/quiz/define'
import week01 from './week-01'
import week02 from './week-02'
import week03 from './week-03'

export const weeklyQuizzes: readonly WeeklyQuiz[] = [week01, week02, week03].sort((a, b) => (a.week ?? 0) - (b.week ?? 0))

if (new Set(weeklyQuizzes.map((w) => w.id)).size !== weeklyQuizzes.length) throw new Error('Duplicate weekly quiz ids.')

export function getWeeklyQuiz(id: string): WeeklyQuiz {
  const w = weeklyQuizzes.find((q) => q.id === id)
  if (!w) throw new Error(`Unknown weekly quiz "${id}".`)
  return w
}
