// Course pages are Markdown: a heading, then its text. This wraps every `##` section (and the
// text before the first one) in <section class="abschnitt">, so a section can be one visual
// area – a card, a band – instead of headings floating in one long column. Idempotent.
export default function rehypeAbschnitte() {
  return (tree) => {
    const kids = tree.children ?? []
    if (kids.some((k) => k.type === 'element' && k.tagName === 'section' && k.properties?.className?.includes('abschnitt'))) return
    const out = []
    let current = null
    const open = (intro) => {
      current = { type: 'element', tagName: 'section', properties: { className: intro ? ['abschnitt', 'abschnitt-intro'] : ['abschnitt'] }, children: [] }
      out.push(current)
    }
    for (const k of kids) {
      if (k.type === 'element' && k.tagName === 'h2') open(false)
      else if (!current) {
        // whitespace and imports before any content stay outside
        if (k.type === 'text' && !k.value.trim()) {
          out.push(k)
          continue
        }
        if (k.type === 'mdxjsEsm') {
          out.push(k)
          continue
        }
        open(true)
      }
      current.children.push(k)
    }
    tree.children = out
  }
}
