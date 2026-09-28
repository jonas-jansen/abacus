/**
 * A framework-free SVG tree. Axes, annotations and the SSR data layer are produced as plain
 * data so this package needs no React; `applet-ui` maps nodes to elements, and
 * `svgToString` serves static export.
 */

export interface SvgNode {
  tag: string
  attrs?: Record<string, string | number | undefined>
  children?: SvgNode[]
  text?: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function svgToString(node: SvgNode): string {
  const attrs = Object.entries(node.attrs ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
    .join('')
  const inner = (node.text !== undefined ? esc(node.text) : '') + (node.children ?? []).map(svgToString).join('')
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`
}
