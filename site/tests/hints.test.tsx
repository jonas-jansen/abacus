// @vitest-environment jsdom
/** Hint cards (keys per operating system) and the page settings that switch them off. */

import { renderTip } from '../../packages/applet-ui/src/tip'
import { einstellung, setEinstellung } from '@abacus/applet-ui/settings'
import { afterEach, describe, expect, it } from 'vitest'

const keysOf = (el: HTMLElement) => [...el.querySelectorAll('kbd')].map((k) => k.textContent)

describe('hint cards', () => {
  it('draws the keys of the computer at hand', () => {
    const el = document.createElement('div')
    renderTip('{Mod} + {Z} | rückgängig\n{Redo} | wiederholen', el, true)
    expect(keysOf(el)).toEqual(['⌘', 'Z', '⇧', '⌘', 'Z'])
    renderTip('{Mod} + {Z} | rückgängig\n{Redo} | wiederholen', el, false)
    expect(keysOf(el)).toEqual(['Strg', 'Z', 'Strg', 'Y'])
    expect(el.hasAttribute('data-rows')).toBe(true)
    expect(el.querySelectorAll('.ab-tipcard-what')[1].textContent).toBe('wiederholen')
  })

  it('shows icons for pointer gestures and keeps plain text plain', () => {
    const el = document.createElement('div')
    renderTip('{Shift} + {Ziehen} | verschieben', el, false)
    expect(el.querySelector('.ab-tipcard-icon svg')).not.toBeNull()
    renderTip('<b>kein</b> HTML', el, false)
    expect(el.querySelector('b')).toBeNull()
    expect(el.textContent).toBe('<b>kein</b> HTML')
    expect(el.hasAttribute('data-rows')).toBe(false)
  })
})

describe('settings', () => {
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.hinweise
  })

  it('are on by default, stored, and mirrored on <html>', () => {
    expect(einstellung('hinweise')).toBe('an')
    setEinstellung('hinweise', 'aus')
    expect(document.documentElement.dataset.hinweise).toBe('aus')
    delete document.documentElement.dataset.hinweise
    expect(einstellung('hinweise')).toBe('aus') // from storage
  })
})
