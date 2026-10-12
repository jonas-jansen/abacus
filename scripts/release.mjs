// Builds an upload: only what the release profile in site/releases.json names, into
// release/<name>/ and release/<name>.zip. `pnpm release [name]` (default: students).
// Set ABACUS_BASE when the site will live under a sub-path, e.g. ABACUS_BASE=/applets/.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const name = process.argv[2] ?? 'students'
const profiles = JSON.parse(readFileSync(join(root, 'site/releases.json'), 'utf8'))
if (!profiles[name] || typeof profiles[name] === 'string') {
  console.error(`No release "${name}" in site/releases.json. Known: ${Object.keys(profiles).filter((k) => k !== 'note').join(', ')}`)
  process.exit(1)
}
const out = join(root, 'release', name)
rmSync(out, { recursive: true, force: true })
rmSync(`${out}.zip`, { force: true })
execFileSync('pnpm', ['--filter', 'site', 'exec', 'astro', 'build', '--outDir', out], {
  stdio: 'inherit',
  env: { ...process.env, ABACUS_RELEASE: name },
})
if (!existsSync(join(out, 'index.html'))) throw new Error('The build produced no index.html.')
execFileSync('zip', ['-qr', `${name}.zip`, name], { cwd: join(root, 'release') })
const p = profiles[name]
console.log(`\n✓ release/${name}/ and release/${name}.zip`)
console.log(`  courses: ${p.courses.join(', ')} · applets: ${p.applets.join(', ') || '–'} · quizzes: ${p.quizzes.join(', ') || '–'} · guided pages: ${p.pages.join(', ') || '–'}`)
console.log(`  base path: ${process.env.ABACUS_BASE ?? '/'} (set ABACUS_BASE for a sub-path)`)
