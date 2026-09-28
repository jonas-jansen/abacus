/**
 * German number formatting, done by hand rather than through `Intl` so that server and
 * client produce byte-identical output (SSR first paint must match hydration).
 */

const MINUS = '−'

const NNBSP = '\u202f'

function tidy(s: string): string {
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1)
  // Group thousands from five digits on: 12 500 · 1 000 000 (not 2026 or 1000).
  s = s.replace(/^(-?)(\d{5,})/, (_, sign: string, int: string) => sign + int.replace(/\B(?=(\d{3})+$)/g, NNBSP))
  return s.replace('.', ',').replace('-', MINUS)
}

/** Fixed number of decimals: `formatFixed(0.5, 2)` → "0,50". */
export function formatFixed(v: number, decimals: number): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? MINUS + '∞' : '—'
  return tidy(v.toFixed(Math.max(0, Math.min(20, decimals))))
}

/** Significant digits, trailing zeros removed: `formatNumber(3.14159, 3)` → "3,14". */
export function formatNumber(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return formatFixed(v, 0)
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e9 || abs < 1e-4) {
    const [m, e] = v.toExponential(digits - 1).split('e')
    return `${tidy(String(Number(m)))}·10${superscript(Number(e))}`
  }
  return tidy(String(Number(v.toPrecision(digits))))
}

const SUP: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
}
const superscript = (n: number) => [...String(n)].map((c) => SUP[c] ?? c).join('')

/** Number of decimals needed to show multiples of `step` exactly (0.25 → 2, 5 → 0). */
export function decimalsOf(step: number): number {
  if (!(step > 0) || step >= 1) return 0
  for (let d = 0; d < 12; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-9) return d
  return 12
}

export function roundTo(v: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(v * f) / f
}
