/**
 * Registry of all applets. `pnpm new-applet <id>` adds entries between the markers.
 * Adding an applet must require touching this package only (§3, second rule).
 */

import { KAPITEL, KAPITEL_ORDER, type AnyAppletDef, type Kapitel } from '@abacus/applet-ui/define'
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
import eulerHeun from './euler-heun'
import geometric from './geometric'
import linearsystemPhase from './linearsystem-phase'
import logIvp from './log-ivp'
import logisticVergleich from './logistic-vergleich'
import logisticCobweb from './logistic-cobweb'

const list: AnyAppletDef[] = [
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

// sorted by chapter of the slides; within a chapter in the order of the list above
const byChapter = [...list].sort((a, b) => KAPITEL_ORDER.indexOf(a.kapitel) - KAPITEL_ORDER.indexOf(b.kapitel))

export const applets: Readonly<Record<string, AnyAppletDef>> = Object.fromEntries(byChapter.map((a) => [a.id, a]))

/** The applets grouped by chapter, in the order of the slides. Empty chapters are left out. */
export function kapitel(): { id: Kapitel; titel: string; applets: AnyAppletDef[] }[] {
  return KAPITEL_ORDER.map((id) => ({ id, titel: KAPITEL[id], applets: byChapter.filter((a) => a.kapitel === id) })).filter((k) => k.applets.length > 0)
}

export function getApplet(id: string): AnyAppletDef {
  const def = applets[id]
  if (!def) throw new Error(`Unbekanntes Applet "${id}". Registriert: ${Object.keys(applets).join(', ')}`)
  return def
}
