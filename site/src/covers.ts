/**
 * Course pictures for the landing page: small drawings in the course colours, no axes.
 * They take their colours from the theme (CSS variables), so they work light and dark.
 */

/** The cobweb of the logistic map y ↦ a y (1 − y): the parabola, the diagonal, the sequence climbing into a two-cycle. */
export function cobweb({ a = 3.2, y0 = 0.05, climb = 4 } = {}): string {
  const [W, H, pad] = [300, 190, 16]
  const s = H - 2 * pad
  const x0 = (W - s) / 2
  const X = (u: number) => (x0 + u * s).toFixed(1)
  const Y = (v: number) => (H - pad - v * s).toFixed(1)
  const f = (y: number) => a * y * (1 - y)
  const parabola = 'M' + Array.from({ length: 61 }, (_, i) => `${X(i / 60)} ${Y(f(i / 60))}`).join('L')
  // the first steps of the climb, then the two-cycle it ends in, drawn once (its points are
  // the roots of a²y² − a(a+1)y + (a+1) = 0); the loops in between would only blur it
  let y = y0
  let web = `M${X(y)} ${Y(0)}`
  for (let n = 0; n < climb; n++) {
    const z = f(y)
    web += `L${X(y)} ${Y(z)}L${X(z)} ${Y(z)}`
    y = z
  }
  const r = Math.sqrt((a + 1) * (a - 3))
  const [p, q] = [(a + 1 - r) / (2 * a), (a + 1 + r) / (2 * a)]
  const cycle = `M${X(p)} ${Y(p)}L${X(p)} ${Y(q)}L${X(q)} ${Y(q)}L${X(q)} ${Y(p)}Z`
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Spinnwebdiagramm der logistischen Abbildung">
  <path d="M${X(0)} ${Y(0)}L${X(1)} ${Y(1)}" stroke="var(--ab-muted)" stroke-width="1.2" stroke-dasharray="4 4" fill="none" opacity="0.6"/>
  <path d="${web}" stroke="var(--abacus-secondary)" stroke-width="1.4" fill="none" stroke-linejoin="round" opacity="0.55"/>
  <path d="${cycle}" stroke="var(--abacus-secondary)" stroke-width="2" fill="none" stroke-linejoin="round"/>
  <path d="${parabola}" stroke="var(--abacus-primary)" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <circle cx="${X(y0)}" cy="${Y(0)}" r="4.5" fill="var(--ab-bg)" stroke="var(--abacus-secondary)" stroke-width="2"/>
</svg>`
}
