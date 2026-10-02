/**
 * The release plan (site/freigabe.json): its rules, and that the real plan is valid and
 * consistent – a typo must fail here, not silently hide or show the wrong applet.
 */

import { describe, expect, it } from 'vitest'
import { appletFreigabe, offen, PLAN, pruefen, seitenFreigabe, type Plan } from '../src/freigabe'

const leer: Plan = { semesterbeginn: null, kapitel: {}, applets: {}, seiten: {}, vorschau: true }

/** The course pages' ids and frontmatter, read from the files. */
const dateien = import.meta.glob('../src/content/seiten/*.mdx', { query: '?raw', import: 'default', eager: true })
const seiten = Object.entries(dateien)
  .map(([pfad, text]) => {
    const f = pfad.split('/').pop()!
    const feld = (k: string) => new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(text)?.[1].trim()
    return { id: f.replace(/\.mdx$/, ''), data: { woche: Number(feld('woche')), applet: String(feld('applet')), entwurf: feld('entwurf') === 'true' } }
  })

describe('release plan', () => {
  it('releases on the day and after, never before; "verborgen" never', () => {
    expect(offen('sofort', '2026-10-01')).toBe(true)
    expect(offen('2026-11-03', '2026-11-02')).toBe(false)
    expect(offen('2026-11-03', '2026-11-03')).toBe(true)
    expect(offen('verborgen', '2099-01-01')).toBe(false)
  })

  it('an applet follows its chapter unless it has its own entry', () => {
    const p: Plan = { ...leer, kapitel: { I: '2026-10-13' }, applets: { heron: 'sofort' } }
    expect(appletFreigabe('newton', p)).toBe('2026-10-13')
    expect(appletFreigabe('heron', p)).toBe('sofort')
    expect(appletFreigabe('pendel', p)).toBe('sofort') // chapter IV not planned
  })

  it('course pages follow their week from the semester start', () => {
    const p: Plan = { ...leer, semesterbeginn: '2026-10-12', seiten: { b: 'verborgen' } }
    expect(seitenFreigabe({ id: 'a', data: { woche: 1 } }, p)).toBe('sofort')
    expect(seitenFreigabe({ id: 'a', data: { woche: 3 } }, p)).toBe('2026-10-26')
    expect(seitenFreigabe({ id: 'b', data: { woche: 3 } }, p)).toBe('verborgen')
    expect(seitenFreigabe({ id: 'c', data: { woche: 2, entwurf: true } }, p)).toBe('verborgen')
    expect(seitenFreigabe({ id: 'a', data: { woche: 3 } }, leer)).toBe('sofort')
  })

  it('names every mistake in a plan', () => {
    const p = { ...leer, semesterbeginn: '12.10.2026', kapitel: { V: 'sofort' }, applets: { neuton: 'bald' }, seiten: { gibtsnicht: 'sofort' } } as Plan
    const f = pruefen(p, ['geometrische-folgen'])
    expect(f.join('\n')).toMatch(/semesterbeginn/)
    expect(f.join('\n')).toMatch(/"V" gibt es nicht/)
    expect(f.join('\n')).toMatch(/"neuton" ist kein Applet/)
    expect(f.join('\n')).toMatch(/"bald" ist kein gültiger Wert/)
    expect(f.join('\n')).toMatch(/"gibtsnicht" ist keine Kursseite/)
  })

  it('the real plan is valid', () => {
    expect(seiten.length).toBeGreaterThan(0)
    expect(seiten.every((x) => Number.isFinite(x.data.woche) && x.data.applet !== 'undefined')).toBe(true)
    expect(pruefen(PLAN, seiten.map((s) => s.id))).toEqual([])
  })

  it('no course page is released before its applet', () => {
    for (const s of seiten) {
      const sv = seitenFreigabe(s)
      const av = appletFreigabe(s.data.applet)
      if (sv === 'verborgen' || av === 'sofort') continue
      expect(av, `${s.id} braucht ${s.data.applet}`).not.toBe('verborgen')
      if (sv !== 'sofort') expect(av <= sv, `${s.id} (${sv}) erscheint vor ${s.data.applet} (${av})`).toBe(true)
      else expect(av, `${s.id} ist sofort sichtbar, ${s.data.applet} erst ${av}`).toBe('sofort')
    }
  })
})
