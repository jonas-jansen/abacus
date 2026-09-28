#!/usr/bin/env node
// Screenshots pages of the running dev server, and reports console errors.
//   node scripts/shoot.mjs <outDir> /path [/path …] [--width 1280] [--dark]

import { chromium } from 'playwright'

const args = process.argv.slice(2)
const out = args[0]
const flag = (name, dflt) => {
  const i = args.indexOf(name)
  return i < 0 ? dflt : args[i + 1]
}
const width = Number(flag('--width', 1280))
const dark = args.includes('--dark')
const paths = args.slice(1).filter((a, i, all) => a.startsWith('/') && all[i - 1] !== '--width')
const base = process.env.BASE ?? 'http://localhost:4321'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 })
page.on('console', (m) => m.type() === 'error' && console.log(`  console error: ${m.text()}`))
page.on('pageerror', (e) => console.log(`  page error: ${e.message}`))
for (const p of paths) {
  await page.goto(base + p, { waitUntil: 'networkidle' })
  // Scroll through once so client:visible islands hydrate, then back to the top.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 60))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(600)
  const file = `${out}/${(p.replace(/[/#?.=&]+/g, '_') || 'root').replace(/^_|_$/g, '') || 'index'}-${width}${dark ? '-dark' : ''}.png`
  await page.screenshot({ path: file, fullPage: true })
  console.log(file)
}
await browser.close()
