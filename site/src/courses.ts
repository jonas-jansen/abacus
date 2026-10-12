/**
 * The courses on the platform. Each lives under its own address (/<id>/: start page, applets,
 * guided pages, quizzes, notebook); the landing page lists them all.
 *
 * `id` is the address and part of every notebook key (with `semester`): changing either
 * later orphans the answers students have stored.
 */

import type { NotebookScope } from '@abacus/quiz'

export interface Course {
  /** Address and notebook scope: lower case, digits, '-'. */
  id: string
  title: string
  /** Part of the notebook key, e.g. 'ws2026'. */
  semester: string
  /** Shown to students, e.g. "Wintersemester 2026/27". */
  term: string
}

export const courses: readonly Course[] = [
  { id: 'mathe-bio', title: 'Mathematik für Biowissenschaften', semester: 'ws2026', term: 'Wintersemester 2026/27' },
]

for (const c of courses) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id)) throw new Error(`Course id "${c.id}": lower case letters, digits and '-' only.`)
}

export function getCourse(id: string): Course {
  const c = courses.find((x) => x.id === id)
  if (!c) throw new Error(`Unknown course "${id}". Known: ${courses.map((x) => x.id).join(', ')}`)
  return c
}

export const scopeOf = (c: Course): NotebookScope => ({ kurs: c.id, semester: c.semester })
