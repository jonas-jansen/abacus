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
    const formeln = typeof def.formeln === 'function' ? def.formeln(p) : def.formeln
    expect(formeln?.length, 'every applet states its model').toBeGreaterThan(0)
    for (const f of formeln ?? []) {
      for (const mode of ['symbole', 'zahlen'] as const) {
        const tex = expandFormula(f.tex, def.model.params, p, mode)
        expect(tex, `unresolved placeholder in ${f.label}`).not.toMatch(/\{\{/)
        expect(() => render(tex), `${f.label} (${mode}): ${tex}`).not.toThrow()
      }
    }
  })

  it('writes numbers the German way, with signs joining the operator', () => {
    expect(texNumber(0.8)).toBe('0{,}8')
    expect(texNumber(-1.25)).toBe('-1{,}25')
    expect(texNumber(1.2e-6)).toBe('1{,}2 \\cdot 10^{-6}')
    expect(texNumber(12500)).toBe('12\\,500')
    const specs = applets.arithmetic.model.params
    const p = { ...defaultParams(applets.arithmetic.model), b: -2 }
    expect(expandFormula('x_n {{+b}}', specs, p, 'zahlen')).toBe('x_n - \\htmlData{param=b}{2}')
    expect(expandFormula('x_n {{+b}}', specs, p, 'symbole')).toBe('x_n + \\htmlData{param=b}{b}')
  })
})
