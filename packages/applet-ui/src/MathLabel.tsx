import { TeX } from './TeX'

/** Plain text with `$…$` math, e.g. "Fixpunkte $y^*$". Used for readout labels. */
export function MathLabel({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean)
  return (
    <>
      {parts.map((p, i) =>
        p.length > 2 && p.startsWith('$') && p.endsWith('$') ? <TeX key={i} tex={p.slice(1, -1)} /> : <span key={i}>{p}</span>,
      )}
    </>
  )
}

/** The label as plain text, for aria-labels and titles: "Fixpunkte $y^*$" → "Fixpunkte y*". */
export const plainLabel = (text: string) => text.replace(/\$([^$]+)\$/g, (_, t: string) => t.replace(/\^/g, '').replace(/[{}\\]/g, ''))
