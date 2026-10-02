/**
 * Registry of all applets: the code (the modules below) joined with the catalog
 * (../applets.json: title, description, chapter, slides, listed or not – one line per applet,
 * edited by hand). `pnpm new-applet <id>` adds both. The catalog's order is the order in the
 * overview, within each chapter.
 */

import { KAPITEL, KAPITEL_ORDER, type AnyAppletDef, type AppletModul, type Kapitel } from '@abacus/applet-ui/define'
import katalog from '../applets.json'
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

const module: AppletModul<any>[] = [
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

export interface KatalogEintrag {
  id: string
  sichtbar: boolean
  kapitel: Kapitel
  folien: string
  titel: string
  kurz: string
}

/** The catalog joined with the code; a mismatch fails loudly, naming what to fix. */
export function verbinden(eintraege: readonly KatalogEintrag[], mods: readonly AppletModul<any>[]): AnyAppletDef[] {
  const code = new Map(mods.map((m) => [m.id, m]))
  const fehler: string[] = []
  const gesehen = new Set<string>()
  for (const e of eintraege) {
    if (gesehen.has(e.id)) fehler.push(`"${e.id}" steht zweimal in applets.json.`)
    gesehen.add(e.id)
    if (!code.has(e.id)) fehler.push(`"${e.id}" steht in applets.json, aber es gibt kein Applet mit dieser id.`)
    if (!(KAPITEL_ORDER as readonly string[]).includes(e.kapitel)) fehler.push(`"${e.id}": kapitel "${e.kapitel}" gibt es nicht (${KAPITEL_ORDER.join(', ')}).`)
    if (typeof e.sichtbar !== 'boolean') fehler.push(`"${e.id}": sichtbar muss true oder false sein.`)
    if (!e.titel || !e.kurz) fehler.push(`"${e.id}": titel und kurz dürfen nicht leer sein.`)
  }
  for (const m of mods) if (!gesehen.has(m.id)) fehler.push(`Das Applet "${m.id}" fehlt in applets.json.`)
  if (fehler.length) throw new Error(`packages/applets/applets.json:\n  ${fehler.join('\n  ')}`)
  return eintraege.map((e) => ({ ...code.get(e.id)!, ...e, folien: e.folien || undefined }) as AnyAppletDef)
}

const list = verbinden(katalog.applets as KatalogEintrag[], module)

// sorted by chapter of the slides; within a chapter in the order of the catalog
const byChapter = [...list].sort((a, b) => KAPITEL_ORDER.indexOf(a.kapitel) - KAPITEL_ORDER.indexOf(b.kapitel))

export const applets: Readonly<Record<string, AnyAppletDef>> = Object.fromEntries(byChapter.map((a) => [a.id, a]))

/**
 * The applets grouped by chapter, in the order of the slides; only those listed in the
 * overview unless `alle`. Empty chapters are left out.
 */
export function kapitel({ alle = false } = {}): { id: Kapitel; titel: string; applets: AnyAppletDef[] }[] {
  return KAPITEL_ORDER.map((id) => ({ id, titel: KAPITEL[id], applets: byChapter.filter((a) => a.kapitel === id && (alle || a.sichtbar !== false)) })).filter(
    (k) => k.applets.length > 0,
  )
}

export function getApplet(id: string): AnyAppletDef {
  const def = applets[id]
  if (!def) throw new Error(`Unbekanntes Applet "${id}". Registriert: ${Object.keys(applets).join(', ')}`)
  return def
}
