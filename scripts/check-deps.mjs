#!/usr/bin/env node
// Enforces the package dependency rules (spec §3). The core tsconfig already has no DOM lib;
// this catches forbidden imports, which a type check alone would not.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname

// Containers never import each other: applets (applet-ui), quizzes (quiz) and content (site)
// talk only through @abacus/channel.
const rules = {
  'packages/applet-core': ['@abacus/', 'react', 'react-dom'],
  'packages/applet-plot': ['@abacus/applet-ui', '@abacus/quiz', '@abacus/applets', '@abacus/quizzes', '@abacus/channel', 'react'],
  'packages/channel': ['@abacus/', 'react'],
  'packages/applet-ui': ['@abacus/quiz', '@abacus/quizzes', '@abacus/applets'],
  'packages/quiz': ['@abacus/applet-ui', '@abacus/applet-plot', '@abacus/applets', '@abacus/quizzes'],
  // Definitions are data and functions only, no components.
  'packages/applets': ['react', 'react-dom', '@abacus/applet-ui', '@abacus/quiz', '@abacus/quizzes'],
  'packages/quizzes': ['react', 'react-dom', '@abacus/quiz', '@abacus/applet-ui', '@abacus/applets'],
}
// …except the React-free definition entry points and core's own name.
const allowed = {
  'packages/applet-core': [],
  'packages/applets': ['@abacus/applet-ui/define'],
  'packages/quizzes': ['@abacus/quiz/define'],
}

const files = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })

let failures = 0
for (const [pkg, forbidden] of Object.entries(rules)) {
  for (const file of files(join(root, pkg, 'src'))) {
    const src = readFileSync(file, 'utf8')
    for (const [, spec] of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      if ((allowed[pkg] ?? []).includes(spec)) continue
      if (forbidden.some((f) => spec === f || spec.startsWith(f.endsWith('/') ? f : f + '/'))) {
        console.error(`✗ ${relative(root, file)} imports "${spec}" — not allowed in ${pkg}`)
        failures++
      }
    }
  }
}

if (failures) process.exit(1)
console.log('✓ package dependency rules hold')
