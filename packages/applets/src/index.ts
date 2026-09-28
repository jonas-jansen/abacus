/**
 * Registry of all applets. `pnpm new-applet <id>` adds entries between the markers.
 * Adding an applet must require touching this package only (§3, second rule).
 */

import type { AnyAppletDef } from '@abacus/applet-ui/define'
// @new-applet:imports
import arithmetic from './arithmetic'
import newtonCooling from './newton-cooling'
import heron from './heron'
import updatefunction from './updatefunction'
import logisticRk from './logistic-rk'
import logisticBifurcation from './logistic-bifurcation'
import logisticPerturbation from './logistic-perturbation'
import predatorPrey from './predator-prey'
import predatorPreyMap from './predator-prey-map'
import sir from './sir'
import linearsystemDiscrete from './linearsystem-discrete'
import expIvp from './exp-ivp'
import linearFamily from './linear-family'
import linearIvp from './linear-ivp'
import logIvpData from './log-ivp-data'
import romeoJulia from './romeo-julia'
import michaelisMenten from './michaelis-menten'
import eulerHeun from './euler-heun'
import geometric from './geometric'
import linearsystemPhase from './linearsystem-phase'
import logIvp from './log-ivp'
import logisticCobweb from './logistic-cobweb'

const list: AnyAppletDef[] = [
  // @new-applet:entries
  // 1 sequences and recursions
  arithmetic,
  geometric,
  heron,
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
  linearsystemDiscrete,
  // 5 scalar ODEs
  expIvp,
  linearFamily,
  linearIvp,
  logIvp,
  logIvpData,
  // 6 planar linear ODEs
  linearsystemPhase,
  romeoJulia,
  // 7 nonlinear ODE systems
  michaelisMenten,
  // 8 numerics
  eulerHeun,
]

export const applets: Readonly<Record<string, AnyAppletDef>> = Object.fromEntries(list.map((a) => [a.id, a]))

export function getApplet(id: string): AnyAppletDef {
  const def = applets[id]
  if (!def) throw new Error(`Unbekanntes Applet "${id}". Registriert: ${Object.keys(applets).join(', ')}`)
  return def
}
