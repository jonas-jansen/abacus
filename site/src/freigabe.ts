/**
 * Release plan: which applets and course pages students see, and from when. The plan is
 * site/freigabe.json (edited by the admin, e.g. in GitHub's web editor); the build applies
 * it, and a daily rebuild lets dates take effect without a push.
 *
 * This is curation, not access control: the site is static and its JavaScript contains every
 * applet. Protecting content needs the server (Shibboleth, later).
 */

import { applets } from '@abacus/applets'
import { KAPITEL_ORDER } from '@abacus/applet-ui/define'
import plan from '../freigabe.json'

/** "sofort", "verborgen", or a day "JJJJ-MM-TT" from which on it is visible. */
export type Freigabe = string

export interface Plan {
  semesterbeginn: string | null
  kapitel: Record<string, Freigabe>
  applets: Record<string, Freigabe>
  seiten: Record<string, Freigabe>
  vorschau: boolean
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/

const gueltig = (v: unknown): v is Freigabe =>
  v === 'sofort' || v === 'verborgen' || (typeof v === 'string' && DATUM.test(v) && !Number.isNaN(Date.parse(v)))

/** Everything wrong with a plan, as sentences for the admin (empty: fine). */
export function pruefen(p: Plan, seitenIds: readonly string[] = []): string[] {
  const fehler: string[] = []
  const wert = (wo: string, v: unknown) => {
    if (!gueltig(v)) fehler.push(`${wo}: "${String(v)}" ist kein gültiger Wert – "sofort", "verborgen" oder ein Datum wie "2026-11-03".`)
  }
  if (p.semesterbeginn !== null && !(typeof p.semesterbeginn === 'string' && DATUM.test(p.semesterbeginn))) {
    fehler.push(`semesterbeginn: "${String(p.semesterbeginn)}" ist kein Datum wie "2026-10-12" (oder null).`)
  }
  for (const [k, v] of Object.entries(p.kapitel)) {
    if (!(KAPITEL_ORDER as readonly string[]).includes(k)) fehler.push(`kapitel: "${k}" gibt es nicht (${KAPITEL_ORDER.join(', ')}).`)
    wert(`kapitel.${k}`, v)
  }
  for (const [id, v] of Object.entries(p.applets)) {
    if (!(id in applets)) fehler.push(`applets: "${id}" ist kein Applet. Ids stehen in der Adresse: /applet/<id>.`)
    wert(`applets.${id}`, v)
  }
  for (const [id, v] of Object.entries(p.seiten)) {
    if (seitenIds.length && !seitenIds.includes(id)) fehler.push(`seiten: "${id}" ist keine Kursseite. Ids stehen in der Adresse: /kurs/<id>.`)
    wert(`seiten.${id}`, v)
  }
  return fehler
}

export const PLAN = plan as Plan

/** Today in Germany as "JJJJ-MM-TT"; ABACUS_HEUTE overrides it (to see the site as of a day). */
export function heute(): string {
  // read at build time (Node); there is no such variable in the browser
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ABACUS_HEUTE
  if (env && DATUM.test(env)) return env
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date())
}

/** Whether a release value means "visible" on `tag`. */
export const offen = (v: Freigabe, tag: string) => v === 'sofort' || (DATUM.test(v) && v <= tag)

/** When an applet is released: its own entry, else its chapter's, else now. */
export function appletFreigabe(id: string, p: Plan = PLAN): Freigabe {
  return p.applets[id] ?? p.kapitel[applets[id]?.kapitel] ?? 'sofort'
}

/** When a course page is released: its own entry, else its week counted from the semester start. */
export function seitenFreigabe(seite: { id: string; data: { woche: number; entwurf?: boolean } }, p: Plan = PLAN): Freigabe {
  if (seite.data.entwurf) return 'verborgen'
  const eigen = p.seiten[seite.id]
  if (eigen) return eigen
  if (!p.semesterbeginn || seite.data.woche <= 1) return 'sofort'
  const d = new Date(`${p.semesterbeginn}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7 * (seite.data.woche - 1))
  return d.toISOString().slice(0, 10)
}

/** The local dev server shows everything (marked), the built site only what is released. */
export const ALLES = import.meta.env.DEV

export const appletSichtbar = (id: string, tag = heute()) => ALLES || offen(appletFreigabe(id), tag)
export const seiteSichtbar = (seite: Parameters<typeof seitenFreigabe>[0], tag = heute()) => ALLES || offen(seitenFreigabe(seite), tag)

/** "ab 3. November 2026", "verborgen", "sofort" – for the overview and the dev badges. */
export function freigabeText(v: Freigabe): string {
  if (v === 'sofort') return 'sofort'
  if (v === 'verborgen') return 'verborgen'
  return 'ab ' + new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${v}T00:00:00Z`))
}

/** Fails the build on a broken plan: better than silently showing or hiding the wrong things. */
export function planOderFehler(seitenIds: readonly string[]): Plan {
  const fehler = pruefen(PLAN, seitenIds)
  if (fehler.length) throw new Error(`site/freigabe.json:\n  ${fehler.join('\n  ')}`)
  return PLAN
}
