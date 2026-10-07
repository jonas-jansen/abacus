// Every applet's formulas expand and typeset cleanly, with symbols and with numbers.

import katex from 'katex'
import { defaultParams } from '@abacus/applet-core'
import { applets } from '@abacus/applets'
import { expandFormula, texNumber } from '@abacus/applet-ui'
import { describe, expect, it } from 'vitest'

const render = (tex: string) =>
  katex.renderToString(tex, { throwOnError: true, strict: false, trust: (c) => c.command === '\\htmlData' })

describe('formulas', () => {
  it.each(Object.keys(applets))('%s: formulas render in both modes', (id) => {
    const def = applets[id]
    const p = defaultParams(def.model)
    const formulas = typeof def.formulas === 'function' ? def.formulas(p) : def.formulas
    expect(formulas?.length ?? 0, `${def.id}: \`formulas\` fehlt – every applet states its model above the plots (docs/applets.md, "Formeln")`).toBeGreaterThan(0)
    for (const f of formulas ?? []) {
      for (const mode of ['symbole', 'zahlen'] as const) {
        const tex = expandFormula(f.tex, def.model.params, p, mode)
        expect(tex, `unresolved placeholder in ${f.label}`).not.toMatch(/\{\{/)
        expect(() => render(tex), `${f.label} (${mode}): ${tex}`).not.toThrow()
      }
    }
  })

  it.each(Object.keys(applets))('%s: every parameter can be changed in the formulas', (id) => {
    const def = applets[id]
    const p0 = defaultParams(def.model)
    // formulas may depend on a choice (e.g. linear or quadratic): look at every option
    const variants = [p0, ...def.model.params.flatMap((s) => (s.kind === 'choice' ? s.options.map((o) => ({ ...p0, [s.id]: o.value })) : []))]
    const seen = new Set<string>()
    for (const p of variants) {
      const formulas = typeof def.formulas === 'function' ? def.formulas(p) : (def.formulas ?? [])
      for (const f of formulas) for (const m of f.tex.matchAll(/\{\{\s*[+(#]?\s*([A-Za-z_]\w*)/g)) seen.add(m[1])
    }
    // the horizon (N, T) is set in the timeline, not in the formulas
    const missing = def.model.params.map((s) => s.id).filter((pid) => pid !== def.horizon && !seen.has(pid))
    if (def.horizon) expect(seen.has(def.horizon), 'the horizon belongs to the timeline').toBe(false)
    expect(missing, `${def.id}: these parameters appear in no formula – write them as {{name}} into \`formulas\` (or make one the \`horizont\`)`).toEqual([])
  })

  it('writes numbers the German way, with signs joining the operator', () => {
    expect(texNumber(0.8)).toBe('0.8')
    expect(texNumber(-1.25)).toBe('-1.25')
    expect(texNumber(1.2e-6)).toBe('1.2 \\cdot 10^{-6}')
    expect(texNumber(12500)).toBe('12\\,500')
    expect(texNumber(100000)).toBe('100\\,000')
    expect(texNumber(1.4e11)).toBe('1.4 \\cdot 10^{11}')
    const specs = applets.arithmetic.model.params
    const p = { ...defaultParams(applets.arithmetic.model), b: -2 }
    expect(expandFormula('x_n {{+b}}', specs, p, 'zahlen')).toBe('x_n - \\htmlData{param=b}{2}')
    expect(expandFormula('x_n {{+b}}', specs, p, 'symbole')).toBe('x_n + \\htmlData{param=b}{b}')
  })
})
