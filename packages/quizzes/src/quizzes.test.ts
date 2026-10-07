import { grade, rightItems, type QuizDef } from '@abacus/quiz/define'
import { describe, expect, it } from 'vitest'
import { connectWeekly, getWeeklyQuiz, listedWeeklyQuizzes, quizzes, weeklyQuizzes } from './index'

/** The answer the definition calls right, in the shape a student's answer has. */
function keyOf(q: QuizDef): unknown {
  switch (q.type) {
    case 'single':
      return q.correct
    case 'multiple':
      return [...q.correct]
    case 'match':
      return q.pairs.map((_, i) => i)
    case 'number':
      return q.target
    default:
      return undefined
  }
}

describe('every question accepts its own answer key', () => {
  const all = [...Object.values(quizzes), ...weeklyQuizzes.flatMap((w) => w.questions)]
  for (const q of all.filter((x) => ['single', 'multiple', 'match', 'number'].includes(x.type))) {
    it(`${q.id} (${q.type})`, () => expect(grade(q, keyOf(q)).status).toBe('correct'))
  }
  it('number questions accept the edges of their tolerance, and not beyond', () => {
    for (const q of weeklyQuizzes.flatMap((w) => w.questions)) {
      if (q.type !== 'number' || !q.tolerance) continue
      expect(grade(q, q.target + q.tolerance * 0.99).status, q.id).toBe('correct')
      expect(grade(q, q.target - q.tolerance * 0.99).status, q.id).toBe('correct')
      expect(grade(q, q.target + q.tolerance * 5).status, q.id).not.toBe('correct')
    }
  })
  it('distractors of matching questions are not partners', () => {
    for (const q of weeklyQuizzes.flatMap((w) => w.questions)) if (q.type === 'match') expect(rightItems(q).length).toBe(q.pairs.length + (q.distractors?.length ?? 0))
  })
})

describe('weekly quizzes', () => {
  it('the Vorkurs quiz comes first, as week 0', () => {
    expect(weeklyQuizzes[0].id).toBe('vorkurs')
    expect(getWeeklyQuiz('vorkurs').week).toBe(0)
  })
  it('the vorkurs values from the sheets', () => {
    const q = (id: string) => getWeeklyQuiz('vorkurs').questions.find((x) => x.id === id)!
    expect(grade(q('prozent'), '-6.83').status).toBe('correct')
    expect(grade(q('prozent'), (1.1 ** 3 * 0.7 - 1) * 100).status).toBe('correct')
    expect(grade(q('wachstum'), Math.log(20) / Math.log(1.2)).status).toBe('correct')
    expect(grade(q('tangente'), '1.5').status).toBe('correct')
  })
  it('only visible quizzes are listed; the dev server lists all', () => {
    expect(listedWeeklyQuizzes().every((w) => w.visible !== false)).toBe(true)
    expect(listedWeeklyQuizzes({ all: true })).toHaveLength(weeklyQuizzes.length)
  })
  it('catalog and code must agree, naming what to fix', () => {
    const w = weeklyQuizzes[0]
    expect(() => connectWeekly([{ id: w.id, visible: true }, { id: w.id, visible: true }], [w])).toThrow(/twice/)
    expect(() => connectWeekly([{ id: 'nope', visible: true }], [w])).toThrow(/no weekly quiz with this id[\s\S]*is missing/)
  })
})
