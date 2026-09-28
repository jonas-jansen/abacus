/**
 * Axis labels typeset like the formulas in the text, without KaTeX in the render loop:
 * a TeX-lite subset rendered as SVG text. Single Latin letters are italic, everything else
 * upright; `_x` / `_{…}` and `^x` / `^{…}` become sub- and superscripts; `\alpha` etc. map to
 * Greek letters; `*` is a superscript star.
 *
 *   mathText('y_n')  mathText('f(y)')  mathText('x(t)')  mathText('y_{n+1}')  mathText('y^*')
 */

import type { SvgNode } from './svg'

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', lambda: 'λ', mu: 'μ',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω', theta: 'θ',
}

interface Run {
  text: string
  italic: boolean
  shift: 0 | -1 | 1
}

function tokens(src: string, shift: Run['shift'], out: Run[]) {
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if ((c === '_' || c === '^') && i + 1 < src.length) {
      const s: Run['shift'] = c === '_' ? -1 : 1
      let arg: string
      if (src[i + 1] === '{') {
        const end = src.indexOf('}', i + 2)
        arg = src.slice(i + 2, end < 0 ? undefined : end)
        i = end < 0 ? src.length : end + 1
      } else {
        arg = src[i + 1]
        i += 2
      }
      tokens(arg, s, out)
      continue
    }
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(src.slice(i))
      if (m) {
        out.push({ text: GREEK[m[1]] ?? m[1], italic: m[1] in GREEK && m[1][0] === m[1][0].toLowerCase(), shift })
        i += m[0].length
        continue
      }
    }
    if (c === '*' && shift !== 0) {
      out.push({ text: '∗', italic: false, shift })
      i++
      continue
    }
    const italic = /[a-zA-Z]/.test(c) && !/[a-zA-Z]/.test(src[i + 1] ?? '') && !/[a-zA-Z]/.test(src[i - 1] ?? '')
    const last = out[out.length - 1]
    const text = c === '-' ? '−' : c
    if (last && last.italic === italic && last.shift === shift && !italic) last.text += text
    else out.push({ text, italic, shift })
    i++
  }
}

export function mathText(src: string, attrs: SvgNode['attrs'] = {}): SvgNode {
  const runs: Run[] = []
  tokens(src, 0, runs)
  // Baseline offsets in the label's em; SVG dy is cumulative and in the tspan's own em.
  const off = (s: Run['shift']) => (s === -1 ? 0.28 : s === 1 ? -0.42 : 0)
  const SCALE = 0.72
  let level: Run['shift'] = 0
  const children: SvgNode[] = runs.map((r) => {
    const move = off(r.shift) - off(level)
    const dy = move === 0 ? undefined : `${(move / (r.shift === 0 ? 1 : SCALE)).toFixed(3)}em`
    level = r.shift
    return {
      tag: 'tspan',
      attrs: {
        dy,
        'font-size': r.shift === 0 ? undefined : '72%',
        class: r.italic ? 'abacus-math-var' : 'abacus-math-op',
      },
      text: r.text,
    }
  })
  return { tag: 'text', attrs, children }
}
