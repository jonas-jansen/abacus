/**
 * Course pictures for the landing page: one simple shape in the course colours, no axes, no
 * explanation needed. They take their colours from the theme, so they work light and dark.
 */

/** A single S-shaped growth curve: growth that levels off. */
export function growth(): string {
  const [W, H, pad] = [300, 190, 30]
  const f = (u: number) => 1 / (1 + Math.exp(-10 * (u - 0.5)))
  const d = 'M' + Array.from({ length: 61 }, (_, i) => `${(pad + (i / 60) * (W - 2 * pad)).toFixed(1)} ${(H - pad - f(i / 60) * (H - 2 * pad)).toFixed(1)}`).join('L')
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true">
  <path d="${d}" stroke="var(--abacus-primary)" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>`
}
