// @vitest-environment jsdom
/**
 * Integration of the three containers without a browser: applets and quizzes are rendered
 * as separate React roots — like separate islands — and may only meet on the channel.
 */

import { applets, getApplet } from '@abacus/applets'
import { AppletView } from '@abacus/applet-ui'
import { publish, resetChannel } from '@abacus/channel'
import { notebook, QuizView, type NotebookScope } from '@abacus/quiz'
import { getQuiz, quizzes } from '@abacus/quizzes'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const scope: NotebookScope = { kurs: 'test', semester: 'ws' }

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  HTMLCanvasElement.prototype.getContext = () => null
})

const roots: Root[] = []
/** Each call is its own root: containers share nothing but the channel. */
function mount(node: ReactNode): HTMLElement {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  roots.push(root)
  act(() => root.render(node))
  return host
}
afterEach(() => {
  act(() => roots.splice(0).forEach((r) => r.unmount()))
  document.body.innerHTML = ''
  notebook().clear()
  resetChannel()
  window.location.hash = ''
})

const click = (el: Element | null | undefined) => act(() => (el as HTMLElement).click())
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const submit = (form: Element | null) => act(() => form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

describe('server render', () => {
  it.each(Object.keys(applets))('applet %s renders axes and SVG data paths', (id) => {
    const html = renderToString(<AppletView def={getApplet(id)} />)
    expect(html).toContain('abacus-tick')
    expect(html).toMatch(/<path d="M/)
  })

  it.each(Object.keys(quizzes))('quiz %s renders with math', (id) => {
    const html = renderToString(<QuizView def={getQuiz(id)} scope={scope} />)
    expect(html).toContain('class="katex"')
  })

  it('every quiz refers to an existing applet', () => {
    for (const q of Object.values(quizzes)) if (q.applet) expect(applets).toHaveProperty(q.applet)
  })
})

describe('containers on the channel', () => {
  it('a prediction quiz unlocks the applet, and keeps it unlocked after a reload', () => {
    const applet = () => mount(<AppletView def={getApplet('logistic-cobweb')} startLocked />)
    const quiz = () => mount(<QuizView def={getQuiz('log-vorhersage-32')} scope={scope} unlocks="logistic-cobweb" />)
    const a = applet()
    const q = quiz()
    expect(a.querySelector('.ab-locked')).not.toBeNull()
    click(q.querySelector('input[type=radio]'))
    submit(q.querySelector('form'))
    expect(a.querySelector('.ab-locked')).toBeNull()

    // "reload": fresh channel, fresh containers, same notebook
    act(() => roots.splice(0).forEach((r) => r.unmount()))
    resetChannel()
    const a2 = applet()
    quiz()
    expect(a2.querySelector('.ab-locked')).toBeNull()
  })

  it('Finde checks with its own checker and records every attempt', () => {
    const q = mount(<QuizView def={getQuiz('geo-konstant')} scope={scope} />)
    const input = q.querySelector('input') as HTMLInputElement
    type(input, '1,1')
    submit(q.querySelector('form'))
    expect(q.textContent).toContain('zu groß')
    expect(q.querySelector('.katex')).not.toBeNull()
    type(input, '1')
    submit(q.querySelector('form'))
    expect(q.textContent).toContain('Richtig')
    expect(notebook().get('vzms:test:ws:geo-konstant')!.inputs.map((e) => e.status)).toEqual(['wrong', 'correct'])
    expect(q.textContent).toContain('Lösung')
  })

  it('spaeter mode stores without judging', () => {
    const q = mount(<QuizView def={getQuiz('log-schwelle')} scope={scope} />)
    type(q.querySelector('input') as HTMLInputElement, '3')
    submit(q.querySelector('form'))
    expect(q.textContent).not.toContain('Richtig')
    expect(notebook().get('vzms:test:ws:log-schwelle')!.inputs[0].status).toBe('saved')
  })

  it('Erzeuge reads the live applet state from the channel', () => {
    const a = mount(<AppletView def={getApplet('logistic-cobweb')} />)
    const q = mount(<QuizView def={getQuiz('log-periode-4')} scope={scope} />)
    click(button(q, 'Einstellung prüfen'))
    expect(q.textContent).toContain('kommt noch auf einem Punkt zur Ruhe')
    const aField = a.querySelector('input[aria-label="Wachstumsrate a"]') as HTMLInputElement
    type(aField, '3,5')
    act(() => aField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    click(button(q, 'Einstellung prüfen'))
    expect(q.textContent).toContain('Richtig')
  })

  it('applet/command sets parameters from outside', () => {
    const a = mount(<AppletView def={getApplet('geometric')} />)
    act(() => publish('applet/command', { applet: 'geometric', set: { a: -0.5 } }))
    expect((a.querySelector('input[aria-label="Faktor a"]') as HTMLInputElement).value).toBe('−0,5')
  })
})

describe('applet container', () => {
  it('reads the URL hash and writes changes back (debounced)', () => {
    vi.useFakeTimers()
    try {
      window.location.hash = '#geometric.a=-0.5&other.x=1'
      const a = mount(<AppletView def={getApplet('geometric')} />)
      expect((a.querySelector('input[aria-label="Faktor a"]') as HTMLInputElement).value).toBe('−0,5')
      const range = a.querySelector('input.ab-range') as HTMLInputElement
      act(() => range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
      act(() => vi.advanceTimersByTime(300))
      expect(window.location.hash).toBe('#other.x=1&geometric.a=-0.49')
    } finally {
      vi.useRealTimers()
    }
  })

  it('typing beyond the slider range stretches the slider', () => {
    const a = mount(<AppletView def={getApplet('logistic-cobweb')} />)
    const field = a.querySelector('input[aria-label="Wachstumsrate a"]') as HTMLInputElement
    type(field, '7')
    act(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(field.value).toBe('7')
    expect(a.textContent).toContain('Regler erweitert bis 7')
    expect(a.querySelector('.ab-feedback')).toBeNull()
  })

  it('the step count sits in the timeline; a hard limit explains itself there', () => {
    const a = mount(<AppletView def={getApplet('logistic-cobweb')} />)
    expect(a.querySelector('.ab-panel input[aria-label="Schritte N"]')).toBeNull()
    const field = a.querySelector('.ab-timeline input[aria-label="Schritte N"]') as HTMLInputElement
    type(field, '5000')
    act(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(field.value).toBe('5000')
    expect(a.querySelector('.ab-feedback')).toBeNull()
    type(field, '1e9')
    act(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(field.value).toBe('1\u202f000\u202f000')
    expect(a.querySelector('.ab-timeline .ab-feedback')?.textContent).toContain('Million')
  })

  it('a million steps render without trouble', () => {
    const t0 = performance.now()
    const html = renderToString(<AppletView def={getApplet('geometric')} initialState={{ N: 1_000_000, a: -0.999 }} />)
    expect(html).toMatch(/<path d="M/)
    expect(performance.now() - t0).toBeLessThan(3000)
  })

  it('keyboard: arrows step, Shift steps ×10, fine mode narrows the range', () => {
    const a = mount(<AppletView def={getApplet('geometric')} initialState={{ a: 0.5 }} />)
    const range = a.querySelector('input.ab-range') as HTMLInputElement
    const field = a.querySelector('input[aria-label="Faktor a"]') as HTMLInputElement
    act(() => range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(field.value).toBe('0,51')
    act(() => range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true })))
    expect(field.value).toBe('0,41')
    click(a.querySelector('button[aria-label="Feinmodus für Faktor a"]'))
    expect(Number(range.min)).toBeCloseTo(0.21)
    expect(Number(range.max)).toBeCloseTo(0.61)
  })
})

describe('comfort', () => {
  const commit = (field: HTMLInputElement, value: string) => {
    type(field, value)
    act(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  }

  it('undo and redo step through settled states', () => {
    vi.useFakeTimers()
    try {
      const a = mount(<AppletView def={getApplet('geometric')} />)
      const field = () => a.querySelector('input[aria-label="Faktor a"]') as HTMLInputElement
      commit(field(), '0,5')
      act(() => vi.advanceTimersByTime(500))
      commit(field(), '1,2')
      act(() => vi.advanceTimersByTime(500))
      click(a.querySelector('button[aria-label="rückgängig"]'))
      expect(field().value).toBe('0,5')
      click(a.querySelector('button[aria-label="rückgängig"]'))
      expect(field().value).toBe('0,8')
      click(a.querySelector('button[aria-label="wiederholen"]'))
      expect(field().value).toBe('0,5')
      // ⌘Z on the applet does the same
      act(() => a.querySelector('.ab-applet')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true })))
      expect(field().value).toBe('0,8')
    } finally {
      vi.useRealTimers()
    }
  })

  it('comparing keeps the old state and shows what changed', () => {
    const a = mount(<AppletView def={getApplet('geometric')} />)
    // the pin among the tools of the panel
    click(a.querySelector('button[aria-label="vergleichen"]'))
    type(a.querySelector('input[aria-label="Faktor a"]') as HTMLInputElement, '1,1')
    act(() => (a.querySelector('input[aria-label="Faktor a"]') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(a.textContent).toContain('festgehalten')
    expect(a.querySelector('.ab-stat-before')?.textContent).toContain('vorher')
    click(a.querySelector('.ab-legend-ghost'))
    expect(a.textContent).not.toContain('festgehalten')
    // the pin again: hold, and let go
    click(a.querySelector('button[aria-label="vergleichen"]'))
    expect(a.querySelector('button[aria-label="Vergleich lösen"]')?.getAttribute('aria-pressed')).toBe('true')
    click(a.querySelector('button[aria-label="Vergleich lösen"]'))
    expect(a.textContent).not.toContain('festgehalten')
  })
})

describe('weekly quizzes', () => {
  it('are taken, submitted and kept as attempts; the course quizzes and weekly quizzes stay apart', async () => {
    const { getWeeklyQuiz } = await import('@abacus/quizzes')
    const { WeeklyQuizView, weeklyQuizKey } = await import('@abacus/quiz')
    const w = getWeeklyQuiz('woche-01')
    notebook().clear()
    const host = mount(<WeeklyQuizView def={w} scope={scope} />)
    const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!
    act(() => button('Quiz starten').click())
    expect(host.querySelectorAll('.wq-question')).toHaveLength(w.questions.length)

    // the single choice question: pick the right option by its TeX source (options are shuffled)
    const label = [...host.querySelectorAll('.wq-question')[0].querySelectorAll('label')].find((l) => l.textContent?.includes('1{,}05\\,x_n'))!
    act(() => label.querySelector('input')!.click())
    // submit with open questions: asks first, then submits
    act(() => button('Abgeben').click())
    act(() => button('Ja, abgeben').click())

    const entry = notebook().get(weeklyQuizKey(scope, 'woche-01'))!
    expect(entry.type).toBe('weekly')
    expect(entry.inputs).toHaveLength(1)
    expect(entry.inputs[0].display).toBe('Versuch 1: 1 von 4 Punkten')
    expect(host.textContent).toContain('Neuer Versuch')

    // a second attempt is a new entry in the same list
    act(() => button('Neuer Versuch').click())
    act(() => button('Abgeben').click())
    act(() => button('Ja, abgeben').click())
    expect(notebook().get(weeklyQuizKey(scope, 'woche-01'))!.inputs).toHaveLength(2)
  })

  it('every weekly quiz loads, and only holds questions it can show without an applet', async () => {
    const { weeklyQuizzes } = await import('@abacus/quizzes')
    expect(weeklyQuizzes.length).toBeGreaterThan(0)
    for (const w of weeklyQuizzes) for (const f of w.questions) expect(f.type).not.toBe('configure')
  })
})
