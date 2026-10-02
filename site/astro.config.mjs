import { unified } from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import rehypeAbschnitte from './rehype-abschnitte.mjs'

// Deployment: set ABACUS_SITE (e.g. https://mathe.example.de) and ABACUS_BASE (e.g. /applets/)
// when the site does not live at the server root. See docs/deployment.md.
export default defineConfig({
  site: process.env.ABACUS_SITE,
  base: process.env.ABACUS_BASE ?? '/',
  output: 'static',
  integrations: [react(), mdx()],
  // Prose math renders at build time: static HTML plus one stylesheet, no runtime JS (§10).
  markdown: { processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex, rehypeAbschnitte] }) },
  devToolbar: { enabled: false },
})
