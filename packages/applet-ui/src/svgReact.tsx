import { createElement, type ReactNode } from 'react'
import type { SvgNode } from '@abacus/applet-plot'

// SVG attribute names → React prop names ('stroke-width' → 'strokeWidth'); class → className.
const propName = (k: string) =>
  k === 'class' ? 'className' : k.startsWith('data-') || k.startsWith('aria-') ? k : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

// "a: 1; --c: red" → { a: '1', '--c': 'red' }. Custom properties keep their name.
const styleObject = (s: string) =>
  Object.fromEntries(
    s
      .split(';')
      .map((d) => d.split(/:(.*)/s).map((p) => p.trim()))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k.startsWith('--') ? k : propName(k), v]),
  )

export function renderSvg(node: SvgNode, key?: number): ReactNode {
  const props: Record<string, unknown> = { key }
  for (const [k, v] of Object.entries(node.attrs ?? {})) {
    if (v === undefined) continue
    // coordinates to 1/100 px: server and browser may differ in the last bit of a float
    // (auto-scaled axes follow computed data), which would break hydration; nobody sees 0,01 px
    props[propName(k)] = k === 'style' ? styleObject(String(v)) : typeof v === 'number' ? Math.round(v * 100) / 100 : v
  }
  const children = node.children?.map((c, i) => renderSvg(c, i))
  return createElement(node.tag, props, node.text, children)
}
