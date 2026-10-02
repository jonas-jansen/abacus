/**
 * Content of a question, an option or a matching item: text with $math$, or a picture. A
 * plot picture (`{ applet, state }`) is drawn by whoever hosts the quizzes – the site passes
 * a renderer through `QuizImages`, so this package never imports an applet.
 */

import { createContext, useContext, useMemo } from 'react'
import type { Content, QuizImage } from './define'
import { MathText } from './MathText'

export interface ImageRenderer {
  /** SVG markup of an applet's plot in a given state; null if the applet is unknown. */
  plot?: (image: Extract<QuizImage, { applet: string }>) => string | null
  /** The URL of an image file (e.g. with the site's base path). */
  src?: (path: string) => string
}

export const QuizImages = createContext<ImageRenderer>({})

export function ContentView({ c, className }: { c: Content; className?: string }) {
  if (typeof c === 'string') return <MathText text={c} className={className} />
  return <ImageView image={c} className={className} />
}

export function ImageView({ image, className }: { image: QuizImage; className?: string }) {
  const r = useContext(QuizImages)
  const svg = useMemo(() => ('applet' in image ? (r.plot?.(image) ?? null) : null), [r, image])
  const cls = ['qz-image', className].filter(Boolean).join(' ')
  if ('applet' in image) {
    if (!svg) return <span className={cls} data-missing="">Bild fehlt ({image.applet})</span>
    // markup from the plot library: generated, not user input
    return <span className={cls} role="img" aria-label={image.alt ?? 'Plot'} dangerouslySetInnerHTML={{ __html: svg }} />
  }
  return <img className={cls} src={r.src ? r.src(image.src) : image.src} alt={image.alt ?? ''} loading="lazy" draggable={false} />
}
