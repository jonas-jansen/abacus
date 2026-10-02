import { describe, expect, it } from 'vitest'
import { antwortText, beantwortet, bewerte, mischung, rechteSeite } from './bewertung'
import { defineQuiz, type ZuordnungQuiz } from './define'
import { datumText, defineWochenquiz, loesungenSichtbar, phase } from './wochenquiz'

const einfach = defineQuiz({ id: 'e', typ: 'einfach', frage: '?', optionen: ['a', 'b', 'c'], richtig: 1 })
const mehrfach = defineQuiz({ id: 'm', typ: 'mehrfach', frage: '?', optionen: ['a', 'b', 'c', 'd'], richtig: [0, 2] })
const zuordnung = defineQuiz({ id: 'z', typ: 'zuordnung', frage: '?', paare: [['1', 'eins'], ['2', 'zwei'], ['3', 'drei']], ablenker: ['vier'] })
const zahl = defineQuiz({ id: 'n', typ: 'zahl', frage: '?', ziel: 12.5, toleranz: 0.01 })

describe('grading', () => {
  it('single choice', () => {
    expect(bewerte(einfach, 1)).toMatchObject({ status: 'richtig', punkte: 1, max: 1 })
    expect(bewerte(einfach, 0)).toMatchObject({ status: 'falsch', punkte: 0 })
    expect(bewerte(einfach, undefined).punkte).toBe(0)
  })

  it('multiple choice: right choices count, wrong ones take back, never below 0', () => {
    expect(bewerte(mehrfach, [0, 2])).toMatchObject({ status: 'richtig', punkte: 1 })
    expect(bewerte(mehrfach, [0])).toMatchObject({ status: 'nah', punkte: 0.5 })
    expect(bewerte(mehrfach, [0, 1])).toMatchObject({ status: 'falsch', punkte: 0 })
    expect(bewerte(mehrfach, [1, 3]).punkte).toBe(0)
    expect(bewerte(mehrfach, [0, 1]).hinweis).toBe('1 gewählte Aussage stimmt nicht, 1 richtige fehlt.')
  })

  it('matching: each right pair counts', () => {
    expect(bewerte(zuordnung, [0, 1, 2])).toMatchObject({ status: 'richtig', punkte: 1 })
    expect(bewerte(zuordnung, [0, 3, null]).punkte).toBeCloseTo(1 / 3)
    expect(bewerte(zuordnung, [1, 0, 3])).toMatchObject({ status: 'falsch', punkte: 0 })
    expect(rechteSeite(zuordnung as ZuordnungQuiz)).toEqual(['eins', 'zwei', 'drei', 'vier'])
  })

  it('numbers: German or English decimals, tolerance, direction', () => {
    expect(bewerte(zahl, '12,5').status).toBe('richtig')
    expect(bewerte(zahl, 12.509).status).toBe('richtig')
    expect(bewerte(zahl, '12,52')).toMatchObject({ status: 'nah', richtung: 'zu groß' })
    expect(bewerte(zahl, '3')).toMatchObject({ status: 'falsch', richtung: 'zu klein' })
    expect(bewerte(zahl, 'zwölf')).toMatchObject({ status: 'falsch', punkte: 0 })
  })

  it('open answers are recorded, not graded', () => {
    const offen = defineQuiz({ id: 'o', typ: 'antwort', frage: '?' })
    expect(bewerte(offen, 'Text')).toEqual({ status: 'gespeichert', punkte: 0, max: 0 })
  })

  it('knows when a question is answered', () => {
    expect(beantwortet(einfach, 0)).toBe(true)
    expect(beantwortet(mehrfach, [])).toBe(false)
    expect(beantwortet(zuordnung, [null, null, null])).toBe(false)
    expect(beantwortet(zahl, '1,5')).toBe(true)
    expect(beantwortet(zahl, 'x')).toBe(false)
  })

  it('answers as text for the notebook', () => {
    expect(antwortText(einfach, 2)).toBe('c')
    expect(antwortText(mehrfach, [0, 3])).toBe('a; d')
    expect(antwortText(zuordnung, [1, null, 2])).toBe('1 → zwei; 2 → –; 3 → drei')
  })

  it('shuffles reproducibly, as a permutation', () => {
    expect(mischung(6, 'q:1')).toEqual(mischung(6, 'q:1'))
    expect([...mischung(6, 'q:1')].sort()).toEqual([0, 1, 2, 3, 4, 5])
    const verschieden = ['a', 'b', 'c', 'd', 'e'].some((s) => mischung(6, s).join() !== mischung(6, 'q:1').join())
    expect(verschieden).toBe(true)
  })
})

describe('definitions are checked when they load', () => {
  it('catches impossible questions', () => {
    expect(() => defineQuiz({ id: 'x', typ: 'einfach', frage: '?', optionen: ['a', 'b'], richtig: 2 })).toThrow(/Index/)
    expect(() => defineQuiz({ id: 'x', typ: 'mehrfach', frage: '?', optionen: ['a', 'b'], richtig: [] })).toThrow(/richtige/)
    expect(() => defineQuiz({ id: 'x', typ: 'zuordnung', frage: '?', paare: [['1', 'a'], ['2', 'a']] })).toThrow(/verschieden/)
  })

  it('catches broken weekly quizzes', () => {
    const f = [einfach]
    expect(() => defineWochenquiz({ id: 'w', titel: 'W', fragen: [] })).toThrow(/keine Fragen/)
    expect(() => defineWochenquiz({ id: 'w', titel: 'W', fragen: [einfach, einfach] })).toThrow(/doppelte/)
    expect(() => defineWochenquiz({ id: 'w', titel: 'W', fragen: f, loesungen: 'nachFrist' })).toThrow(/bis/)
    expect(() => defineWochenquiz({ id: 'w', titel: 'W', fragen: f, ab: '2026-10-10', bis: '2026-10-01' })).toThrow(/vor/)
    expect(() => defineWochenquiz({ id: 'w', titel: 'W', fragen: [defineQuiz({ id: 'g', typ: 'erzeuge', applet: 'a', frage: '?', pruefer: () => ({ status: 'richtig' }) })] })).toThrow(/Applet/)
  })
})

describe('weekly quiz rules', () => {
  const w = defineWochenquiz({ id: 'w', titel: 'W', fragen: [einfach], ab: '2026-10-05T08:00', bis: '2026-10-12T23:59', loesungen: 'nachFrist' })
  const t = (s: string) => Date.parse(s)

  it('has a window', () => {
    expect(phase(w, t('2026-10-01T12:00'))).toBe('bald')
    expect(phase(w, t('2026-10-08T12:00'))).toBe('offen')
    expect(phase(w, t('2026-10-13T00:30'))).toBe('vorbei')
    expect(phase(defineWochenquiz({ id: 'v', titel: 'V', fragen: [einfach] }), 0)).toBe('offen')
  })

  it('shows solutions after the deadline when told so', () => {
    expect(loesungenSichtbar(w, t('2026-10-08T12:00'))).toBe(false)
    expect(loesungenSichtbar(w, t('2026-10-13T00:30'))).toBe(true)
    expect(loesungenSichtbar({ ...w, loesungen: 'nachAbgabe' }, t('2026-10-08T12:00'))).toBe(true)
  })

  it('prints dates the same everywhere (no time zone)', () => {
    expect(datumText('2026-10-12T23:59')).toBe('Mo, 12.10., 23:59 Uhr')
    expect(datumText('2026-10-05')).toBe('Mo, 05.10.')
  })
})
