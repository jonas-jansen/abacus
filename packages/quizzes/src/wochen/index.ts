/** Registry of the weekly quizzes, in order of the lecture weeks. */

import type { Wochenquiz } from '@abacus/quiz/define'
import woche01 from './woche-01'
import woche02 from './woche-02'
import woche03 from './woche-03'

export const wochenquizze: readonly Wochenquiz[] = [woche01, woche02, woche03].sort((a, b) => (a.woche ?? 0) - (b.woche ?? 0))

if (new Set(wochenquizze.map((w) => w.id)).size !== wochenquizze.length) throw new Error('Doppelte Wochenquiz-Ids.')

export function getWochenquiz(id: string): Wochenquiz {
  const w = wochenquizze.find((q) => q.id === id)
  if (!w) throw new Error(`Unbekanntes Wochenquiz "${id}".`)
  return w
}
