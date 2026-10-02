/**
 * Pointer positions in an element's own CSS pixels. In lecture mode the applet is drawn
 * larger (CSS zoom), so screen pixels and the pixels the plots are laid out in differ by that
 * factor; every conversion from a pointer event goes through here.
 */

/** How much larger the element is drawn than it is laid out (1 normally). */
export function scaleOf(el: Element): number {
  const w = el instanceof HTMLElement ? el.offsetWidth : el.clientWidth
  return w > 0 ? el.getBoundingClientRect().width / w : 1
}

/** A screen position (clientX, clientY) relative to the element's top left corner. */
export function localPoint(el: Element, x: number, y: number): [number, number] {
  const r = el.getBoundingClientRect()
  const w = el instanceof HTMLElement ? el.offsetWidth : el.clientWidth
  const k = w > 0 ? r.width / w : 1
  return [(x - r.left) / k, (y - r.top) / k]
}
