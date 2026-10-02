import { describe, expect, it } from 'vitest'
import { answerText, grade, isAnswered, rightItems, shuffleOrder } from './grading'
import { defineQuiz, type MatchQuiz } from './define'
import { dateText, defineWeeklyQuiz, phase, solutionsVisible } from './weekly'

const einfach = defineQuiz({ id: 'e', type: 'single', question: '?', options: ['a', 'b', 'c'], correct: 1 })
const mehrfach = defineQuiz({ id: 'm', type: 'multiple', question: '?', options: ['a', 'b', 'c', 'd'], correct: [0, 2] })
const zuordnung = defineQuiz({ id: 'z', type: 'match', question: '?', pairs: [['1', 'eins'], ['2', 'zwei'], ['3', 'drei']], distractors: ['vier'] })
const zahl = defineQuiz({ id: 'n', type: 'number', question: '?', target: 12.5, tolerance: 0.01 })

describe('grading', () => {
  it('single choice', () => {
    expect(grade(einfach, 1)).toMatchObject({ status: 'correct', points: 1, max: 1 })
    expect(grade(einfach, 0)).toMatchObject({ status: 'wrong', points: 0 })
    expect(grade(einfach, undefined).points).toBe(0)
  })

  it('multiple choice: right choices count, wrong ones take back, never below 0', () => {
    expect(grade(mehrfach, [0, 2])).toMatchObject({ status: 'correct', points: 1 })
    expect(grade(mehrfach, [0])).toMatchObject({ status: 'close', points: 0.5 })
    expect(grade(mehrfach, [0, 1])).toMatchObject({ status: 'wrong', points: 0 })
    expect(grade(mehrfach, [1, 3]).points).toBe(0)
    expect(grade(mehrfach, [0, 1]).hint).toBe('1 gewählte Aussage stimmt nicht, 1 richtige fehlt.')
  })

  it('matching: each right pair counts', () => {
    expect(grade(zuordnung, [0, 1, 2])).toMatchObject({ status: 'correct', points: 1 })
    expect(grade(zuordnung, [0, 3, null]).points).toBeCloseTo(1 / 3)
    expect(grade(zuordnung, [1, 0, 3])).toMatchObject({ status: 'wrong', points: 0 })
    expect(rightItems(zuordnung as MatchQuiz)).toEqual(['eins', 'zwei', 'drei', 'vier'])
  })

  it('numbers: German or English decimals, tolerance, direction', () => {
    expect(grade(zahl, '12,5').status).toBe('correct')
    expect(grade(zahl, 12.509).status).toBe('correct')
    expect(grade(zahl, '12,52')).toMatchObject({ status: 'close', direction: 'too large' })
    expect(grade(zahl, '3')).toMatchObject({ status: 'wrong', direction: 'too small' })
    expect(grade(zahl, 'zwölf')).toMatchObject({ status: 'wrong', points: 0 })
  })

  it('open answers are recorded, not graded', () => {
    const offen = defineQuiz({ id: 'o', type: 'open', question: '?' })
    expect(grade(offen, 'Text')).toEqual({ status: 'saved', points: 0, max: 0 })
  })

  it('knows when a question is answered', () => {
    expect(isAnswered(einfach, 0)).toBe(true)
    expect(isAnswered(mehrfach, [])).toBe(false)
    expect(isAnswered(zuordnung, [null, null, null])).toBe(false)
    expect(isAnswered(zahl, '1,5')).toBe(true)
    expect(isAnswered(zahl, 'x')).toBe(false)
  })

  it('answers as text for the notebook', () => {
    expect(answerText(einfach, 2)).toBe('c')
    expect(answerText(mehrfach, [0, 3])).toBe('a; d')
    expect(answerText(zuordnung, [1, null, 2])).toBe('1 → zwei; 2 → –; 3 → drei')
  })

  it('shuffles reproducibly, as a permutation', () => {
    expect(shuffleOrder(6, 'q:1')).toEqual(shuffleOrder(6, 'q:1'))
    expect([...shuffleOrder(6, 'q:1')].sort()).toEqual([0, 1, 2, 3, 4, 5])
    const differs = ['a', 'b', 'c', 'd', 'e'].some((s) => shuffleOrder(6, s).join() !== shuffleOrder(6, 'q:1').join())
    expect(differs).toBe(true)
  })
})

describe('definitions are checked when they load', () => {
  it('catches impossible questions', () => {
    expect(() => defineQuiz({ id: 'x', type: 'single', question: '?', options: ['a', 'b'], correct: 2 })).toThrow(/index/)
    expect(() => defineQuiz({ id: 'x', type: 'multiple', question: '?', options: ['a', 'b'], correct: [] })).toThrow(/correct option/)
    expect(() => defineQuiz({ id: 'x', type: 'match', question: '?', pairs: [['1', 'a'], ['2', 'a']] })).toThrow(/must differ/)
  })

  it('catches broken weekly quizzes', () => {
    const f = [einfach]
    expect(() => defineWeeklyQuiz({ id: 'w', title: 'W', questions: [] })).toThrow(/no questions/)
    expect(() => defineWeeklyQuiz({ id: 'w', title: 'W', questions: [einfach, einfach] })).toThrow(/duplicate/)
    expect(() => defineWeeklyQuiz({ id: 'w', title: 'W', questions: f, solutions: 'after-close' })).toThrow(/closes/)
    expect(() => defineWeeklyQuiz({ id: 'w', title: 'W', questions: f, opens: '2026-10-10', closes: '2026-10-01' })).toThrow(/not before/)
    expect(() => defineWeeklyQuiz({ id: 'w', title: 'W', questions: [defineQuiz({ id: 'g', type: 'configure', applet: 'a', question: '?', checker: () => ({ status: 'correct' }) })] })).toThrow(/needs an applet/)
  })
})

describe('weekly quiz rules', () => {
  const w = defineWeeklyQuiz({ id: 'w', title: 'W', questions: [einfach], opens: '2026-10-05T08:00', closes: '2026-10-12T23:59', solutions: 'after-close' })
  const t = (s: string) => Date.parse(s)

  it('has a window', () => {
    expect(phase(w, t('2026-10-01T12:00'))).toBe('upcoming')
    expect(phase(w, t('2026-10-08T12:00'))).toBe('open')
    expect(phase(w, t('2026-10-13T00:30'))).toBe('closed')
    expect(phase(defineWeeklyQuiz({ id: 'v', title: 'V', questions: [einfach] }), 0)).toBe('open')
  })

  it('shows solutions after the deadline when told so', () => {
    expect(solutionsVisible(w, t('2026-10-08T12:00'))).toBe(false)
    expect(solutionsVisible(w, t('2026-10-13T00:30'))).toBe(true)
    expect(solutionsVisible({ ...w, solutions: 'after-submit' }, t('2026-10-08T12:00'))).toBe(true)
  })

  it('prints dates the same everywhere (no time zone)', () => {
    expect(dateText('2026-10-12T23:59')).toBe('Mo, 12.10., 23:59 Uhr')
    expect(dateText('2026-10-05')).toBe('Mo, 05.10.')
  })
})
