/**
 * Seeded randomness (§4.8): xoshiro128** seeded through splitmix32. The seed is part of
 * `RunOptions` and of the URL state, so every student sees the same perturbation and the
 * text can say "look at n = 14".
 */

export interface Rng {
  readonly seed: number
  /** Uniform in [0, 1). */
  next(): number
  /** Standard normal (Box–Muller). */
  normal(): number
}

const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k))

export function createRng(seed: number): Rng {
  let sm = seed | 0
  const splitmix = () => {
    sm = (sm + 0x9e3779b9) | 0
    let t = sm ^ (sm >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t ^= t >>> 15
    t = Math.imul(t, 0x735a2d97)
    return (t ^ (t >>> 15)) >>> 0
  }
  let a = splitmix()
  let b = splitmix()
  let c = splitmix()
  let d = splitmix()

  const next32 = () => {
    const r = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0
    const t = b << 9
    c ^= a
    d ^= b
    b ^= c
    a ^= d
    c ^= t
    d = rotl(d, 11)
    return r
  }

  let spare: number | null = null
  const next = () => next32() / 4294967296
  return {
    seed,
    next,
    normal() {
      if (spare !== null) {
        const s = spare
        spare = null
        return s
      }
      let u = 0
      while (u === 0) u = next()
      const v = next()
      const r = Math.sqrt(-2 * Math.log(u))
      spare = r * Math.sin(2 * Math.PI * v)
      return r * Math.cos(2 * Math.PI * v)
    },
  }
}
