/**
 * The release profile of an upload (site/releases.json, chosen by ABACUS_RELEASE at build
 * time): only the applets, weekly quizzes and course pages it names are built and listed.
 * Without ABACUS_RELEASE everything is built, as before.
 */

import { applets } from '@abacus/applets'
import { weeklyQuizzes } from '@abacus/quizzes'
import releases from '../releases.json'

type Profile = { applets: string[]; quizzes: string[]; course: string[] }
type Kind = keyof Profile

// read at build time (Node); the site's types have no Node globals
declare const process: { env: Record<string, string | undefined> }
const name = process.env.ABACUS_RELEASE

function load(): Profile | null {
  if (!name) return null
  const p = (releases as unknown as Record<string, Profile | string>)[name]
  if (!p || typeof p === 'string') throw new Error(`ABACUS_RELEASE="${name}": no such profile in site/releases.json.`)
  const unknown = [...p.applets.filter((id) => !applets[id]).map((id) => `applet "${id}"`), ...p.quizzes.filter((id) => !weeklyQuizzes.some((w) => w.id === id)).map((id) => `quiz "${id}"`)]
  if (unknown.length) throw new Error(`site/releases.json, "${name}": unknown ${unknown.join(', ')}.`)
  return p
}

export const release = load()

/** Whether this build contains the applet, quiz or course page `id`. */
export const included = (kind: Kind, id: string): boolean => !release || release[kind].includes(id)

/** Whether this build has course pages at all (the "Kurs" area is left out otherwise). */
export const withCourse = !release || release.course.length > 0
