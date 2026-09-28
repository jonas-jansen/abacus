/** Registry of all quizzes. Ids are global: a quiz can appear on any page. */

import type { QuizDef } from '@abacus/quiz/define'
import geometrisch from './geometrisch'
import logistik from './logistik'
import wachstum from './wachstum'

const list: QuizDef[] = [...geometrisch, ...logistik, ...wachstum]

export const quizzes: Readonly<Record<string, QuizDef>> = Object.fromEntries(list.map((q) => [q.id, q]))

if (Object.keys(quizzes).length !== list.length) throw new Error('Doppelte Quiz-Ids.')

export function getQuiz(id: string): QuizDef {
  const q = quizzes[id]
  if (!q) throw new Error(`Unbekanntes Quiz "${id}".`)
  return q
}
