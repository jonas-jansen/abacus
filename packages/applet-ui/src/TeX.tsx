import katex from 'katex'
import { useMemo } from 'react'

/** Inline TeX, e.g. a parameter symbol. Same output on server and client. */
export function TeX({ tex, className }: { tex: string; className?: string }) {
  const html = useMemo(() => katex.renderToString(tex, { throwOnError: false }), [tex])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
