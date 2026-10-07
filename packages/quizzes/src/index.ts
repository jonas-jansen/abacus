/** Registry of all questions for course pages. Ids are global: a question can appear on any page. */

import type { QuizDef } from '@abacus/quiz/define'
import arithmetic from './arithmetic'
import geometric from './geometric'
import growth from './growth'
import logistic from './logistic'

const list: QuizDef[] = [...arithmetic, ...geometric, ...logistic, ...growth]

export const quizzes: Readonly<Record<string, QuizDef>> = Object.fromEntries(list.map((q) => [q.id, q]))

if (Object.keys(quizzes).length !== list.length) throw new Error('Duplicate quiz ids.')

export function getQuiz(id: string): QuizDef {
  const q = quizzes[id]
  if (!q) throw new Error(`Unknown quiz "${id}".`)
  return q
}

export { weeklyQuizzes, listedWeeklyQuizzes, getWeeklyQuiz, connectWeekly, type WeeklyCatalogEntry } from './weekly'
