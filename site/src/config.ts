import type { NotebookScope } from '@abacus/quiz'

// Placeholder until the course details are fixed (spec §14, open item 1). `id` and `semester`
// are part of every notebook key — changing them later orphans stored answers.
export const kurs = {
  id: 'dynsys',
  semester: 'ws2026',
  title: 'Mathematik für Biowissenschaften',
}

export const scope: NotebookScope = { kurs: kurs.id, semester: kurs.semester }

/** Base-path-aware link, so the site works under a sub-path on the server. */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${base}/${path.replace(/^\//, '')}`
}
