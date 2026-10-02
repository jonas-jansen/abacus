/**
 * A colour token as the canvas can draw it. Tokens may be derived (`color-mix(…)`), and a
 * custom property hands its text over unresolved; the browser resolves it as an element's
 * `color`. Cached by that text, so a change of theme or mode simply misses the cache.
 */

import { useEffect, useState } from 'react'
import { onFarbwechsel } from './settings'

const cache = new Map<string, string>()
let probe: HTMLSpanElement | null = null

export function cssColor(css: CSSStyleDeclaration, name: string, fallback: string): string {
  const raw = css.getPropertyValue(name).trim()
  if (!raw) return fallback
  if (/^(#|rgba?\()/.test(raw)) return raw
  const hit = cache.get(raw)
  if (hit) return hit
  if (!probe) {
    probe = document.createElement('span')
    probe.style.display = 'none'
  }
  if (!probe.isConnected) document.body.append(probe)
  probe.style.color = ''
  probe.style.color = raw
  const out = probe.style.color ? getComputedStyle(probe).color : fallback
  cache.set(raw, out)
  return out
}

/** A number that changes whenever light or dark changes: a dependency for canvas drawing. */
export function useFarbwechsel(): number {
  const [n, setN] = useState(0)
  useEffect(() => onFarbwechsel(() => setN((k) => k + 1)), [])
  return n
}
