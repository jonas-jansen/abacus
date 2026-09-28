#!/usr/bin/env node
// Scaffolds a new applet and registers it:
//
//   pnpm new-applet <id> [--kind iteration|closedForm|ode] [--seite]
//
// Creates packages/applets/src/<id>.ts from a template, adds it to the registry, and with
// --seite also a page stub in site/src/content/seiten/<id>.mdx. The applet appears on
// /applet/<id> immediately.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const args = process.argv.slice(2)
const id = args.find((a) => !a.startsWith('--'))
const kindArg = args.find((a) => a.startsWith('--kind'))
const kind = kindArg?.includes('=') ? kindArg.split('=')[1] : kindArg ? args[args.indexOf(kindArg) + 1] : 'iteration'
const withPage = args.includes('--seite')

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Verwendung: pnpm new-applet <id> [--kind iteration|closedForm|ode] [--seite]\n  id: Kleinbuchstaben, Ziffern, Bindestriche (z. B. newton-cooling)')
  process.exit(1)
}

const templates = {
  iteration: `import { behaviour, int, iteration, klasse, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = iteration({
  id: '${id}',
  params: {
    a: real('Parameter a', { min: 0, max: 2, step: 0.01, default: 0.5 }),
    x0: real('Startwert x₀', { min: -5, max: 5, step: 0.1, default: 1 }),
    N: int('Anzahl Schritte', { min: 1, max: 100, default: 30 }),
  },
  start: (p) => p.x0,
  // TODO: the update rule x_{n+1} = f(x_n)
  step: (x, p) => p.a * x,
  horizon: (p) => p.N,
  series: { label: 'xₙ' },
  observables: ({ x }) => ({
    verhalten: klasse('Verhalten', behaviour(x)),
    letzter: zahl('letzter Wert', x[x.length - 1]),
  }),
})

export default defineApplet({
  id: '${id}',
  titel: 'TODO Titel',
  kurz: 'TODO ein Satz, was man hier sieht.',
  model,
  plots: [{ type: 'timeSeriesDiscrete', xLabel: 'n', yLabel: 'xₙ' }],
  anzeige: ['verhalten', 'letzter'],
})
`,
  closedForm: `import { closedForm, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = closedForm({
  id: '${id}',
  params: {
    k: real('Rate k', { min: -2, max: 2, step: 0.01, default: -0.5 }),
    x0: real('Anfangswert x₀', { min: 0, max: 10, step: 0.1, default: 5 }),
    T: real('Zeitfenster T', { min: 1, max: 20, step: 1, default: 10 }),
  },
  domain: (p) => [0, p.T],
  curves: {
    // TODO: the closed-form solution
    x: { label: 'x(t)', f: (t, p) => p.x0 * Math.exp(p.k * t) },
  },
  observables: ({ p }) => ({
    endwert: zahl('x(T)', p.x0 * Math.exp(p.k * p.T)),
  }),
})

export default defineApplet({
  id: '${id}',
  titel: 'TODO Titel',
  kurz: 'TODO ein Satz, was man hier sieht.',
  model,
  plots: [{ type: 'timeSeriesContinuous', xLabel: 't', yLabel: 'x(t)' }],
  anzeige: ['endwert'],
})
`,
  ode: `import { events, ode, real, zahl } from '@abacus/applet-core'
import { defineApplet } from '@abacus/applet-ui/define'

const model = ode({
  id: '${id}',
  params: {
    k: real('Rate k', { min: 0, max: 2, step: 0.01, default: 0.5 }),
    x0: real('Anfangswert x₀', { min: 0, max: 10, step: 0.1, default: 5 }),
    T: real('Zeitfenster T', { min: 1, max: 20, step: 1, default: 10 }),
  },
  components: [{ id: 'x', label: 'x(t)' }],
  start: (p) => [p.x0],
  // TODO: the right-hand side y' = f(t, y)
  rhs: (_t, y, p) => [-p.k * y[0]],
  tEnd: (p) => p.T,
  observables: ({ p, sol }) => {
    const [tHalf] = events(sol, (_t, y) => y[0] - p.x0 / 2)
    return { halbwertszeit: zahl('Halbwertszeit', tHalf ?? null, tHalf === undefined ? { note: 'nicht im Zeitfenster' } : {}) }
  },
})

export default defineApplet({
  id: '${id}',
  titel: 'TODO Titel',
  kurz: 'TODO ein Satz, was man hier sieht.',
  model,
  plots: [{ type: 'timeSeriesContinuous', xLabel: 't', yLabel: 'x(t)' }],
  anzeige: ['halbwertszeit'],
})
`,
}

if (!templates[kind]) {
  console.error(`Unbekannte Art "${kind}". Möglich: ${Object.keys(templates).join(', ')}`)
  process.exit(1)
}

const file = join(root, 'packages/applets/src', `${id}.ts`)
if (existsSync(file)) {
  console.error(`${file} existiert bereits.`)
  process.exit(1)
}
writeFileSync(file, templates[kind])

const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
const indexFile = join(root, 'packages/applets/src/index.ts')
const index = readFileSync(indexFile, 'utf8')
if (!index.includes('// @new-applet:imports') || !index.includes('// @new-applet:entries')) {
  console.error('Marker in packages/applets/src/index.ts fehlen – bitte von Hand eintragen.')
  process.exit(1)
}
writeFileSync(
  indexFile,
  index
    .replace('// @new-applet:imports', `// @new-applet:imports\nimport ${camel} from './${id}'`)
    .replace('// @new-applet:entries', `// @new-applet:entries\n  ${camel},`),
)

console.log(`✓ packages/applets/src/${id}.ts (${kind})`)
console.log('✓ in packages/applets/src/index.ts registriert')

if (withPage) {
  const page = join(root, 'site/src/content/seiten', `${id}.mdx`)
  if (!existsSync(page)) {
    writeFileSync(
      page,
      `---
titel: TODO
kurz: TODO
woche: 0
applet: ${id}
gesperrt: false
entwurf: true
---

## Mit Papier

TODO – eine konkrete Frage, kein Formalismus. Quizze liegen in packages/quizzes/src/ und
werden hier per Id eingebunden: <Quiz id="…" nr={1} />

## Aufgaben

## Vom Bild zur Behauptung

<Behauptung>TODO</Behauptung>

## Wo das Bild lügt

<Bildluege>TODO</Bildluege>
`,
    )
    console.log(`✓ site/src/content/seiten/${id}.mdx`)
  }
}

console.log(`\nNächste Schritte: Modell in ${id}.ts ausfüllen, dann \`pnpm dev\` → /applet/${id}`)
