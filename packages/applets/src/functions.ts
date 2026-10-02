// Functions for the Anhang applets (derivatives, integrals): each with its derivative and an
// antiderivative, so difference quotients and Riemann sums can be compared with exact values.

export interface FunctionEntry {
  /** Choice label (text with $math$). */
  label: string
  /** TeX of f(x). */
  tex: string
  f: (x: number) => number
  df: (x: number) => number
  /** An antiderivative. */
  F: (x: number) => number
  /** Where f is defined (and drawn). */
  domain: readonly [number, number]
}

export const FUNCTIONS = {
  x2: { label: '$x^2$', tex: 'x^2', f: (x) => x * x, df: (x) => 2 * x, F: (x) => x ** 3 / 3, domain: [-3, 3] },
  x3: { label: '$x^3$', tex: 'x^3', f: (x) => x ** 3, df: (x) => 3 * x * x, F: (x) => x ** 4 / 4, domain: [-2.5, 2.5] },
  poly: {
    label: '$x^4 - x^2 + 3$',
    tex: 'x^4 - x^2 + 3',
    f: (x) => x ** 4 - x * x + 3,
    df: (x) => 4 * x ** 3 - 2 * x,
    F: (x) => x ** 5 / 5 - x ** 3 / 3 + 3 * x,
    domain: [-2, 2],
  },
  lin: { label: '$x - 1$', tex: 'x - 1', f: (x) => x - 1, df: () => 1, F: (x) => x * x / 2 - x, domain: [-1, 4] },
  inv: { label: '$1/x$', tex: '\\frac{1}{x}', f: (x) => 1 / x, df: (x) => -1 / (x * x), F: (x) => Math.log(x), domain: [0.1, 4] },
  sqrt: { label: '$\\sqrt{x}$', tex: '\\sqrt{x}', f: (x) => Math.sqrt(x), df: (x) => 0.5 / Math.sqrt(x), F: (x) => (2 / 3) * x ** 1.5, domain: [0, 4] },
  exp: { label: '$e^x$', tex: 'e^x', f: Math.exp, df: Math.exp, F: Math.exp, domain: [-2.5, 2] },
  sin: { label: '$\\sin x$', tex: '\\sin x', f: Math.sin, df: Math.cos, F: (x) => -Math.cos(x), domain: [-3.5, 3.5] },
} satisfies Record<string, FunctionEntry>

export type FunctionId = keyof typeof FUNCTIONS

/** Choice options for a selection of functions. */
export const functionChoices = <K extends FunctionId>(ids: readonly K[]) => ids.map((value) => ({ value, label: FUNCTIONS[value].label }))

/** x clamped into the domain of f, a little inside. */
export function inDomain(id: FunctionId, x: number): number {
  const [a, b] = FUNCTIONS[id].domain
  const pad = (b - a) * 0.01
  return Math.min(b - pad, Math.max(a + (id === 'sqrt' ? 0 : pad), x))
}
