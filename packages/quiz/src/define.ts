/**
 * Quiz definitions — the second container. A quiz is self-contained (question, checker,
 * hints, solution) and reusable on any page. If it refers to an applet, it only knows the
 * applet's id and reads its state from the channel; it never imports the applet.
 *
 * Text fields accept inline math: `$f'(y^*) = 2 - a$`, display math with `$$…$$`.
 */

import { schwelle, type Params, type Pruefer } from '@abacus/applet-core'

interface Base {
  /** Globally unique and stable: the notebook stores answers under it. */
  id: string
  frage: string
  /** Applet whose live state the checker receives. */
  applet?: string
  /** Progressive hint ladder. */
  tipps?: readonly string[]
  /** Shown only after an attempt has been recorded. */
  loesung?: string
  /** Bump when the question changes meaning, so old answers are not mixed with new ones. */
  version?: number
}

export interface VorhersageQuiz extends Base {
  typ: 'vorhersage'
  /** Multiple choice; free text if omitted. */
  optionen?: readonly string[]
}

export interface FindeQuiz extends Base {
  typ: 'finde'
  /** The quantity, e.g. "a" or "t*". */
  groesse: string
  einheit?: string
  /** Stated to the student ("auf 0,05 genau"). */
  toleranz?: number
  pruefer?: Pruefer<any>
  /** sofort: immediate diagnosis · spaeter: stored, confronted with the proof later · keine: recorded only. */
  pruefung?: 'sofort' | 'spaeter' | 'keine'
}

export interface ErzeugeQuiz extends Base {
  typ: 'erzeuge'
  applet: string
  /** Receives the applet's current params and observables. */
  pruefer: Pruefer<any>
}

export interface AntwortQuiz extends Base {
  typ: 'antwort'
  /** Shown after the answer is saved, to compare with. Open answers are not checked by the computer. */
  musterloesung?: string
  /** What a good answer contains: shown with the model answer (and, later, for grading). */
  kriterien?: readonly string[]
}

/** One right option among several. */
export interface EinfachQuiz extends Base {
  typ: 'einfach'
  optionen: readonly string[]
  /** Index into `optionen`. */
  richtig: number
  /** Options in a new order per attempt (default true); false keeps e.g. "keine davon" last. */
  mischen?: boolean
}

/** Any number of right options, at least one. */
export interface MehrfachQuiz extends Base {
  typ: 'mehrfach'
  optionen: readonly string[]
  /** Indices into `optionen`. */
  richtig: readonly number[]
  mischen?: boolean
}

/** Pairs to match: every left item gets its right partner, chosen from all right items (plus distractors). */
export interface ZuordnungQuiz extends Base {
  typ: 'zuordnung'
  paare: readonly (readonly [string, string])[]
  /** Right items that belong to no left item. */
  ablenker?: readonly string[]
}

/** A number, checked against a target. */
export interface ZahlQuiz extends Base {
  typ: 'zahl'
  ziel: number
  /** Absolute tolerance; default: exact to 6 significant digits. */
  toleranz?: number
  /** The quantity asked for, e.g. "$x_5$"; shown before the field. */
  groesse?: string
  einheit?: string
}

export type QuizDef = VorhersageQuiz | FindeQuiz | ErzeugeQuiz | AntwortQuiz | EinfachQuiz | MehrfachQuiz | ZuordnungQuiz | ZahlQuiz
export type QuizTyp = QuizDef['typ']

type FindeInput = Omit<FindeQuiz, 'pruefer'> & ({ pruefer: Pruefer<any>; ziel?: never } | { ziel: number; pruefer?: never } | { ziel?: never; pruefer?: never })

/** Shorthand: `{ typ: 'finde', ziel: 3, toleranz: 0.05 }` builds the `schwelle` checker. */
export function defineQuiz<P extends Params = Params>(def: Exclude<QuizDef, FindeQuiz> | FindeInput): QuizDef {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(def.id)) throw new Error(`Quiz id "${def.id}": letters, digits, '-' and '_' only.`)
  pruefeDef(def as QuizDef)
  if (def.typ === 'finde' && 'ziel' in def && def.ziel !== undefined) {
    const { ziel, ...rest } = def
    return { ...rest, pruefer: schwelle<P>({ ziel, toleranz: def.toleranz ?? 0 }) }
  }
  return def as QuizDef
}

/** Catches authoring mistakes when the definitions load, with the quiz named. */
function pruefeDef(def: QuizDef): void {
  const fehler = (m: string) => {
    throw new Error(`Quiz "${def.id}": ${m}`)
  }
  if (def.typ === 'einfach') {
    if (def.optionen.length < 2) fehler('mindestens zwei Optionen.')
    if (!Number.isInteger(def.richtig) || def.richtig < 0 || def.richtig >= def.optionen.length) fehler('`richtig` ist kein Index in `optionen`.')
  }
  if (def.typ === 'mehrfach') {
    if (def.optionen.length < 2) fehler('mindestens zwei Optionen.')
    if (!def.richtig.length) fehler('mindestens eine richtige Option.')
    if (def.richtig.some((i) => !Number.isInteger(i) || i < 0 || i >= def.optionen.length)) fehler('`richtig` enthält keinen Index in `optionen`.')
  }
  if (def.typ === 'zuordnung') {
    if (def.paare.length < 2) fehler('mindestens zwei Paare.')
    const rechts = [...def.paare.map((p) => p[1]), ...(def.ablenker ?? [])]
    if (new Set(rechts).size !== rechts.length) fehler('rechte Seiten (und Ablenker) müssen verschieden sein.')
  }
  if (def.typ === 'zahl' && !Number.isFinite(def.ziel)) fehler('`ziel` ist keine Zahl.')
}

export * from './wochenquiz'
export { antwortText, bewerte, beantwortet, richtigeAntwort, rechteSeite, mischung, PRUEFBAR, type Bewertung } from './bewertung'
