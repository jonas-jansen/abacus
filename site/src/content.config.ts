import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const seiten = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/seiten' }),
  schema: z.object({
    titel: z.string(),
    kurz: z.string(),
    woche: z.number().int().nonnegative(),
    /** The page's central applet, shown large and sticky beside the text. */
    applet: z.string(),
    zustand: z.record(z.string(), z.unknown()).optional(),
    /** Keep the applet locked until a `<Quiz schaltetFrei>` on the page is answered. */
    gesperrt: z.boolean().default(false),
    voraussetzungen: z.array(z.string()).default([]),
    entwurf: z.boolean().default(false),
  }),
})

export const collections = { seiten }
