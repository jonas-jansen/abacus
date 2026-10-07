import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const course = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/course' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    week: z.number().int().nonnegative(),
    /** The page's central applet, shown large and sticky beside the text. */
    applet: z.string(),
    state: z.record(z.string(), z.unknown()).optional(),
    /** Keep the applet locked until a `<Quiz schaltetFrei>` on the page is answered. */
    locked: z.boolean().default(false),
    prerequisites: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** Order within a week (smaller first); then by title. */
    order: z.number().default(0),
  }),
})

/**
 * An applet's introduction: plain Markdown in src/content/intro/<applet-id>.md, written by
 * hand. Shown below the applet on its own page and as the first section of its course pages.
 */
const intro = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/intro' }),
  schema: z.object({
    /** The small heading above the text. */
    title: z.string().default('Worum es geht'),
  }),
})

export const collections = { course, intro }
