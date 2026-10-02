/**
 * Hints on hover: every element with `data-tip` gets a small card after a short rest, instead
 * of the browser's slow grey `title`. One listener on the document serves the whole page.
 *
 * The text is a tiny markup, so key combinations read as keys and match the computer:
 *   - lines are separated by `\n`;
 *   - `keys | text` makes a row with the keys on the left;
 *   - `{Mod}`, `{Shift}`, `{Z}`, `{Rad}` … become key caps or small icons (see KEYS).
 *
 * `data-tip-at="pointer"` puts the card under the pointer (for the plot area): it shows
 * whenever the pointer rests there and hides as soon as it moves on — until the plot is
 * actually used (a click, the wheel, a key); then it stays away until the pointer leaves. All of it is off when the page
 * setting "Hinweise" is off (html[data-hinweise="aus"]), e.g. while teaching with a projector.
 */

import { einstellung } from './settings'

const DELAY = 350

export const isMac = () =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test((navigator as any).userAgentData?.platform ?? navigator.platform ?? navigator.userAgent)

const ICONS: Record<string, string> = {
  // a mouse with its wheel
  Rad: '<svg viewBox="0 0 16 16" width="15" height="15"><rect x="3.5" y="1.5" width="9" height="13" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 4v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  // a hand dragging: arrows in four directions
  Ziehen: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5v13M1.5 8h13M6 3.5l2-2 2 2M6 12.5l2 2 2-2M3.5 6l-2 2 2 2M12.5 6l2 2-2 2"/></svg>',
  // two clicks
  Doppelklick: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M5.5 5.5v8.2l2.2-2.1 1.6 3.4 1.5-.7-1.6-3.3h3z" fill="currentColor" stroke="none"/><path d="M3.2 5.5a2.3 2.3 0 1 1 4.6 0M1.2 5.5a4.3 4.3 0 1 1 8.6 0" stroke-linecap="round"/></svg>',
  // two fingers spreading
  Finger: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="11.5" r="1.6"/><circle cx="11.5" cy="4.5" r="1.6"/><path d="M1.8 14.2 3.3 12.7M14.2 1.8 12.7 3.3M6 10l4-4"/></svg>',
}

/** Key caps, per operating system. Macros expand into several keys. */
function keys(mac: boolean): Record<string, string[]> {
  return {
    Mod: [mac ? '⌘' : 'Strg'],
    Shift: [mac ? '⇧' : 'Umschalt'],
    Alt: [mac ? '⌥' : 'Alt'],
    Leer: ['Leertaste'],
    Esc: ['Esc'],
    Plus: ['+'],
    Minus: ['−'],
    Null: ['0'],
    Redo: mac ? ['⇧', '⌘', 'Z'] : ['Strg', 'Y'],
  }
}

/** Builds the card's content from the markup; text only ever goes in as text. */
export function renderTip(src: string, into: HTMLElement, mac = isMac()): void {
  into.replaceChildren()
  const caps = keys(mac)
  const inline = (s: string, parent: HTMLElement) => {
    for (const part of s.split(/(\{[A-Za-z]+\})/)) {
      if (!part) continue
      const m = /^\{([A-Za-z]+)\}$/.exec(part)
      if (!m) {
        // "+" between keys is drawn small and quiet
        if (part.trim() === '+') {
          const plus = document.createElement('span')
          plus.className = 'ab-tipcard-plus'
          plus.textContent = '+'
          parent.append(plus)
        } else parent.append(part)
        continue
      }
      const name = m[1]
      if (ICONS[name]) {
        const i = document.createElement('span')
        i.className = 'ab-tipcard-icon'
        i.innerHTML = ICONS[name]
        parent.append(i)
        continue
      }
      for (const k of caps[name] ?? [name]) {
        const kbd = document.createElement('kbd')
        kbd.textContent = k
        parent.append(kbd)
      }
    }
  }
  for (const line of src.split('\n')) {
    const bar = line.indexOf(' | ')
    if (bar < 0) {
      const p = document.createElement('div')
      p.className = 'ab-tipcard-text'
      inline(line, p)
      into.append(p)
      continue
    }
    const k = document.createElement('div')
    k.className = 'ab-tipcard-keys'
    inline(line.slice(0, bar), k)
    const t = document.createElement('div')
    t.className = 'ab-tipcard-what'
    t.textContent = line.slice(bar + 3)
    into.append(k, t)
  }
  into.toggleAttribute('data-rows', src.includes(' | '))
}

let installed = false

/** Installs the one listener; safe to call from every applet. */
export function installTips(): void {
  if (installed || typeof document === 'undefined') return
  installed = true

  const card = document.createElement('div')
  card.className = 'ab-tipcard'
  card.setAttribute('role', 'tooltip')
  card.hidden = true
  document.body.append(card)

  let target: HTMLElement | null = null
  let timer = 0
  let shownAt: [number, number] | null = null
  let last: [number, number] = [0, 0]
  // pointer-anchored hints that were put to use: quiet until the pointer leaves
  const spent = new WeakSet<HTMLElement>()

  const hide = () => {
    clearTimeout(timer)
    card.hidden = true
    shownAt = null
  }

  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const w = card.offsetWidth
    const h = card.offsetHeight
    const pad = 8
    let x: number
    let y: number
    if (el.dataset.tipAt === 'pointer') {
      x = last[0] - w / 2
      y = last[1] + 22
      if (y + h > innerHeight - pad) y = last[1] - h - 16
    } else {
      x = r.left + r.width / 2 - w / 2
      y = r.top - h - 8
      if (y < pad) y = r.bottom + 8
    }
    card.style.left = `${Math.round(Math.min(Math.max(pad, x), innerWidth - w - pad))}px`
    card.style.top = `${Math.round(y)}px`
  }

  const show = (el: HTMLElement) => {
    const src = el.dataset.tip
    if (!src || einstellung('hinweise') === 'aus' || !el.isConnected) return
    renderTip(src, card)
    // in full screen only the full-screen element is drawn: the card goes in there
    const host = document.fullscreenElement ?? document.body
    if (card.parentElement !== host) host.append(card)
    card.hidden = false
    place(el)
    shownAt = [...last]
  }

  const arm = (el: HTMLElement, delay = DELAY) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => target === el && show(el), delay)
  }

  const find = (n: EventTarget | null) => (n instanceof Element ? (n.closest('[data-tip]') as HTMLElement | null) : null)

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return
    const el = find(e.target)
    if (el === target) return
    hide()
    target = el
    last = [e.clientX, e.clientY]
    if (el && !spent.has(el)) arm(el)
  })
  document.addEventListener('pointermove', (e) => {
    // browsers also send moves without movement (after the page under the pointer changed)
    if (e.clientX === last[0] && e.clientY === last[1]) return
    last = [e.clientX, e.clientY]
    if (!target || target.dataset.tipAt !== 'pointer') return
    if (shownAt) {
      if (Math.hypot(last[0] - shownAt[0], last[1] - shownAt[1]) > 12) hide()
    } else if (!spent.has(target)) arm(target) // every move restarts the wait for a rest
  })
  document.addEventListener('pointerout', (e) => {
    if (!target || (e.relatedTarget instanceof Node && target.contains(e.relatedTarget))) return
    if (target.dataset.tipAt === 'pointer') spent.delete(target)
    target = null
    hide()
  })
  // keyboard users get the hint on focus
  document.addEventListener('focusin', (e) => {
    const el = find(e.target)
    if (!el || el.dataset.tipAt === 'pointer' || !(e.target as Element).matches(':focus-visible')) return
    target = el
    const r = el.getBoundingClientRect()
    last = [r.left + r.width / 2, r.bottom]
    arm(el, 150)
  })
  document.addEventListener('focusout', () => {
    if (target && document.activeElement !== target) hide()
  })
  for (const type of ['pointerdown', 'wheel', 'keydown', 'scroll'] as const) {
    document.addEventListener(type, () => {
      hide()
      if (target?.dataset.tipAt === 'pointer') spent.add(target)
    }, { capture: true, passive: true })
  }
  // the text of the element under the pointer can change (e.g. play ↔ pause)
  new MutationObserver(() => {
    if (!card.hidden && target) target.dataset.tip ? renderTip(target.dataset.tip, card) : hide()
  }).observe(document.body, { subtree: true, attributeFilter: ['data-tip'] })
}
