#!/usr/bin/env node
// Scaffolds a new applet and registers it:
//
//   pnpm new-applet <id> [--kind iteration|closedForm|ode] [--page]
//
// Creates packages/applets/src/<id>.ts from a template, adds it to the registry, and with
// --page also a page stub in site/src/content/course/<id>.mdx. The applet appears on
// /applet/<id> immediately. The guide is docs/applets.md.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const args = process.argv.slice(2)
const id = args.find((a) => !a.startsWith('--'))
const kindArg = args.find((a) => a.startsWith('--kind'))
const kind = kindArg?.includes('=') ? kindArg.split('=')[1] : kindArg ? args[args.indexOf(kindArg) + 1] : 'iteration'
const withPage = args.includes('--page')

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Usage: pnpm new-applet <id> [--kind iteration|closedForm|ode] [--page]\n  id: lower-case letters, digits, hyphens (e.g. newton-cooling)')
  process.exit(1)
}

// Each template is a complete applet that passes the checks (formulas in both modes, every
// parameter changeable in the formulas, a handle for the start value): change it, don't fill it.
const head = `// TODO: what this applet shows, and where in the slides (chapter, slide numbers).

`

const templates = {
  iteration: `${head}import { behaviour, iteration, quantity, real, steps } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = iteration({
  id: '${id}',
  params: {
    a: real('Faktor', { latex: 'a', min: 0, max: 2, step: 0.01, default: 0.5 }),
    x0: real('Startwert', { latex: 'x_0', min: -5, max: 5, step: 0.1, default: 1 }),
    N: steps('Schritte', { latex: 'N', default: 30, max: 100 }),
  },
  start: (p) => p.x0,
  // TODO: the update rule x_{n+1} = f(x_n)
  step: (x, p) => p.a * x,
  horizon: (p) => p.N,
  series: { id: 'x', label: 'x_n', name: 'Folge' },
  observables: ({ x }) => ({
    verhalten: behaviour('Verhalten', x),
    letzter: quantity('letzter Wert $x_N$', x[x.length - 1]),
  }),
})

export default defineApplet({
  id: '${id}',
  model,
  horizon: 'N',
  formulas: [
    // {{a}}: the parameter as a chip; {{#x0}}: always its value; {{*}}: a product sign between numbers
    { label: 'Vorschrift', tex: String.raw\`x_{n+1} = {{a}}{{*}}x_n\` },
    { label: 'Start', tex: String.raw\`x_0 = {{#x0}}\` },
  ],
  plots: [{ type: 'timeSeriesDiscrete', xLabel: 'n', yLabel: 'x_n', drag: { param: 'x0', axis: 'y' } }],
  readouts: ['verhalten', 'letzter'],
})
`,
  closedForm: `${head}import { closedForm, quantity, real } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = closedForm({
  id: '${id}',
  params: {
    k: real('Rate', { latex: 'k', min: -2, max: 2, step: 0.01, default: -0.5 }),
    x0: real('Anfangswert', { latex: 'x_0', min: 0, max: 10, step: 0.1, default: 5 }),
    T: real('Zeitfenster', { latex: 'T', min: 1, max: 20, step: 1, default: 10, limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  domain: (p) => [0, p.T],
  curves: {
    // TODO: the closed-form solution
    x: { label: 'x(t)', name: 'Lösung', f: (t, p) => p.x0 * Math.exp(p.k * t) },
  },
  observables: ({ p }) => ({
    endwert: quantity('Endwert $x(T)$', p.x0 * Math.exp(p.k * p.T)),
  }),
})

export default defineApplet({
  id: '${id}',
  model,
  timeline: true,
  horizon: 'T',
  formulas: [
    { label: 'Lösung', tex: String.raw\`x(t) = {{x0}}\\,e^{{{k}}\\,t}\` },
  ],
  plots: [{ type: 'timeSeriesContinuous', xLabel: 't', yLabel: 'x(t)', drag: { param: 'x0', axis: 'y' } }],
  readouts: ['endwert'],
})
`,
  ode: `${head}import { events, ode, quantity, real } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = ode({
  id: '${id}',
  params: {
    k: real('Rate', { latex: 'k', min: 0, max: 2, step: 0.01, default: 0.5 }),
    x0: real('Anfangswert', { latex: 'x_0', min: 0, max: 10, step: 0.1, default: 5 }),
    T: real('Zeitfenster', { latex: 'T', min: 1, max: 20, step: 1, default: 10, limits: { min: 0.01, reason: 'Das Zeitfenster muss positiv sein.' } }),
  },
  // one entry per component; several components give a system (and allow a phase plane)
  components: [{ id: 'x', label: 'x(t)', name: 'Bestand' }],
  start: (p) => [p.x0],
  // TODO: the right-hand side y' = f(t, y)
  rhs: (_t, y, p) => [-p.k * y[0]],
  tEnd: (p) => p.T,
  observables: ({ p, sol }) => {
    const [tHalf] = events(sol, (_t, y) => y[0] - p.x0 / 2)
    return { halbwertszeit: quantity('Halbwertszeit', tHalf ?? null, tHalf === undefined ? { note: 'nicht im Zeitfenster' } : { marks: [{ kind: 'time', t: tHalf }] }) }
  },
})

export default defineApplet({
  id: '${id}',
  model,
  horizon: 'T',
  formulas: [
    { label: 'Gleichung', tex: String.raw\`x' = -{{k}}{{*}}x\` },
    { label: 'Start', tex: String.raw\`x(0) = {{#x0}}\` },
  ],
  plots: [{ type: 'timeSeriesContinuous', xLabel: 't', yLabel: 'x(t)', drag: { param: 'x0', axis: 'y' } }],
  readouts: ['halbwertszeit'],
})
`,
}

if (!templates[kind]) {
  console.error(`Unknown kind "${kind}". Possible: ${Object.keys(templates).join(', ')}`)
  process.exit(1)
}

const file = join(root, 'packages/applets/src', `${id}.ts`)
if (existsSync(file)) {
  console.error(`${file} exists already.`)
  process.exit(1)
}
writeFileSync(file, templates[kind])

const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
const indexFile = join(root, 'packages/applets/src/index.ts')
const index = readFileSync(indexFile, 'utf8')
if (!index.includes('// @new-applet:imports') || !index.includes('// @new-applet:entries')) {
  console.error('The markers in packages/applets/src/index.ts are missing – please register the applet by hand.')
  process.exit(1)
}
writeFileSync(
  indexFile,
  index
    .replace('// @new-applet:imports', `// @new-applet:imports\nimport ${camel} from './${id}'`)
    .replace('// @new-applet:entries', `// @new-applet:entries\n  ${camel},`),
)

// the catalog line: title, description, chapter, slides – and not listed until switched on
const catalogFile = join(root, 'packages/applets/applets.json')
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'))
catalog.applets.push({ id, visible: false, chapter: 'I', slides: '', title: 'TODO Titel', summary: 'TODO ein Satz, was man hier sieht.' })
writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + '\n')

console.log(`✓ packages/applets/src/${id}.ts (${kind})`)
console.log('✓ registered in packages/applets/src/index.ts')
console.log('✓ added to packages/applets/applets.json (visible: false; set title and chapter there)')

if (withPage) {
  const page = join(root, 'site/src/content/course', `${id}.mdx`)
  if (!existsSync(page)) {
    writeFileSync(
      page,
      `---
title: TODO
summary: TODO
week: 0
applet: ${id}
locked: false
draft: true
---

## Mit Papier

TODO – eine konkrete Frage, kein Formalismus. Quizze liegen in packages/quizzes/src/ und
werden hier per Id eingebunden: <Quiz id="…" number={1} />

## Aufgaben

## Vom Bild zur Behauptung

<Claim>TODO</Claim>

## Wo das Bild lügt

<Caveat>TODO</Caveat>
`,
    )
    console.log(`✓ site/src/content/course/${id}.mdx`)
  }
}

console.log(`\nNext: change the model in ${id}.ts (guide: docs/applets.md), then \`pnpm dev\` → /applet/${id}`)
