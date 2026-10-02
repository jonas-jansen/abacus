import katex from 'katex'
import { useMemo } from 'react'

const PATTERN = /\$\$([\s\S]+?)\$\$|\$((?:\\\$|[^$])+?)\$/g

/**
 * Renders text with `$inline$` and `$$display$$` math through KaTeX (server and client alike).
 * Outside math, `**bold**` is the only markup.
 */
export function renderMathText(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  let out = ''
  let last = 0
  for (const m of text.matchAll(PATTERN)) {
    out += esc(text.slice(last, m.index))
    const display = m[1] !== undefined
    out += katex.renderToString(display ? m[1] : m[2], { displayMode: display, throwOnError: false })
    last = m.index + m[0].length
  }
  return out + esc(text.slice(last)).replace(/\n\n+/g, '<br><br>')
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMathText(text), [text])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
