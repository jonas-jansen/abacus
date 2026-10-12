/**
 * The release profile of an upload (site/releases.json, chosen by ABACUS_RELEASE at build
 * time): only the courses, applets, weekly quizzes and guided pages it names are built and listed.
 * Without ABACUS_RELEASE everything is built, as before.
 */

import { applets } from '@abacus/applets'
import { weeklyQuizzes } from '@abacus/quizzes'
import { courses } from './courses'
import releases from '../releases.json'

type Profile = { courses: string[]; applets: string[]; quizzes: string[]; pages: string[] }
type Kind = keyof Profile

// read at build time (Node); the site's types have no Node globals
declare const process: { env: Record<string, string | undefined> }
const name = process.env.ABACUS_RELEASE

function load(): Profile | null {
  if (!name) return null
  const p = (releases as unknown as Record<string, Profile | string>)[name]
  if (!p || typeof p === 'string') throw new Error(`ABACUS_RELEASE="${name}": no such profile in site/releases.json.`)
  const unknown = [...p.courses.filter((id) => !courses.some((c) => c.id === id)).map((id) => `course "${id}"`), ...p.applets.filter((id) => !applets[id]).map((id) => `applet "${id}"`), ...p.quizzes.filter((id) => !weeklyQuizzes.some((w) => w.id === id)).map((id) => `quiz "${id}"`)]
  if (unknown.length) throw new Error(`site/releases.json, "${name}": unknown ${unknown.join(', ')}.`)
  return p
}

export const release = load()

/** Whether this build contains the course, applet, quiz or guided page `id`. */
export const included = (kind: Kind, id: string): boolean => !release || release[kind].includes(id)

/** Whether this build has guided pages at all (the "Kurs" area is left out otherwise). */
export const withPages = !release || release.pages.length > 0

/** The courses this build contains. */
export const builtCourses = courses.filter((c) => included('courses', c.id))
