/**
 * Registry of all applets: the code (the modules below) joined with the catalog
 * (../applets.json: title, description, chapter, slides, listed or not – one entry per applet,
 * edited by hand). `pnpm new-applet <id>` adds both. The catalog's order is the order in the
 * overview, within each chapter.
 */

import { CHAPTERS, CHAPTER_ORDER, type AnyAppletDef, type AppletModule, type Chapter } from '@abacus/applet-ui/define'
import catalog from '../applets.json'
// @new-applet:imports
import folgenGrenzwert from './folgen-grenzwert'
import differenzenquotient from './differenzenquotient'
import lupe from './lupe'
import komplexeZahlen from './komplexe-zahlen'
import eigenvektoren from './eigenvektoren'
import lgs from './lgs'
import riemann from './riemann'
import hauptsatz from './hauptsatz'
import arithmetic from './arithmetic'
import newtonCooling from './newton-cooling'
import heron from './heron'
import newton from './newton'
import updatefunction from './updatefunction'
import logisticRk from './logistic-rk'
import logisticBifurcation from './logistic-bifurcation'
import logisticPerturbation from './logistic-perturbation'
import predatorPrey from './predator-prey'
import predatorPreyMap from './predator-prey-map'
import sir from './sir'
import leslie from './leslie'
import krebs from './krebs'
import aktionspotential from './aktionspotential'
import zellring from './zellring'
import sirStabilitaet from './sir-stabilitaet'
import linearsystemDiscrete from './linearsystem-discrete'
import expIvp from './exp-ivp'
import linearFamily from './linear-family'
import linearIvp from './linear-ivp'
import logIvpData from './log-ivp-data'
import romeoJulia from './romeo-julia'
import pendel from './pendel'
import michaelisMenten from './michaelis-menten'
import bioreaktor from './bioreaktor'
import herzzelle from './herzzelle'
import eulerHeun from './euler-heun'
import geometric from './geometric'
import linearsystemPhase from './linearsystem-phase'
import logIvp from './log-ivp'
import logisticVergleich from './logistic-vergleich'
import logisticCobweb from './logistic-cobweb'

const modules: AppletModule<any>[] = [
  // @new-applet:entries
  // 1 sequences and recursions
  arithmetic,
  geometric,
  heron,
  newton,
  newtonCooling,
  // 2 update functions and fixed points
  updatefunction,
  logisticCobweb,
  // 3 nonlinear discrete dynamics
  logisticRk,
  logisticBifurcation,
  logisticPerturbation,
  // 4 discrete systems
  predatorPrey,
  predatorPreyMap,
  sir,
  sirStabilitaet,
  krebs,
  aktionspotential,
  zellring,
  leslie,
  linearsystemDiscrete,
  // 5 scalar ODEs
  expIvp,
  linearFamily,
  linearIvp,
  logIvp,
  logisticVergleich,
  logIvpData,
  // 6 planar linear ODEs
  linearsystemPhase,
  romeoJulia,
  pendel,
  // 7 nonlinear ODE systems
  michaelisMenten,
  bioreaktor,
  herzzelle,
  // 8 numerics
  eulerHeun,
  // Anhang: mathematical foundations
  folgenGrenzwert,
  differenzenquotient,
  lupe,
  hauptsatz,
  riemann,
  komplexeZahlen,
  lgs,
  eigenvektoren,
]

export interface CatalogEntry {
  id: string
  visible: boolean
  chapter: Chapter
  slides: string
  title: string
  summary: string
}

/** The catalog joined with the code; a mismatch fails loudly, naming what to fix. */
export function connect(entries: readonly CatalogEntry[], mods: readonly AppletModule<any>[]): AnyAppletDef[] {
  const code = new Map(mods.map((m) => [m.id, m]))
  const errors: string[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    if (seen.has(e.id)) errors.push(`"${e.id}" appears twice in applets.json.`)
    seen.add(e.id)
    if (!code.has(e.id)) errors.push(`"${e.id}" is in applets.json, but there is no applet with this id.`)
    if (!(CHAPTER_ORDER as readonly string[]).includes(e.chapter)) errors.push(`"${e.id}": there is no chapter "${e.chapter}" (${CHAPTER_ORDER.join(', ')}).`)
    if (typeof e.visible !== 'boolean') errors.push(`"${e.id}": visible must be true or false.`)
    if (!e.title || !e.summary) errors.push(`"${e.id}": title and summary must not be empty.`)
  }
  for (const m of mods) if (!seen.has(m.id)) errors.push(`The applet "${m.id}" is missing in applets.json.`)
  if (errors.length) throw new Error(`packages/applets/applets.json:\n  ${errors.join('\n  ')}`)
  return entries.map((e) => ({ ...code.get(e.id)!, ...e, slides: e.slides || undefined }) as AnyAppletDef)
}

const list = connect(catalog.applets as CatalogEntry[], modules)

// sorted by chapter of the slides; within a chapter in the order of the catalog
const byChapter = [...list].sort((a, b) => CHAPTER_ORDER.indexOf(a.chapter) - CHAPTER_ORDER.indexOf(b.chapter))

export const applets: Readonly<Record<string, AnyAppletDef>> = Object.fromEntries(byChapter.map((a) => [a.id, a]))

/**
 * The applets grouped by chapter, in the order of the slides; only those listed in the
 * overview unless `all`. Empty chapters are left out.
 */
export function chapters({ all = false } = {}): { id: Chapter; title: string; applets: AnyAppletDef[] }[] {
  return CHAPTER_ORDER.map((id) => ({ id, title: CHAPTERS[id], applets: byChapter.filter((a) => a.chapter === id && (all || a.visible !== false)) })).filter(
    (k) => k.applets.length > 0,
  )
}

export function getApplet(id: string): AnyAppletDef {
  const def = applets[id]
  if (!def) throw new Error(`Unknown applet "${id}". Registered: ${Object.keys(applets).join(', ')}`)
  return def
}
