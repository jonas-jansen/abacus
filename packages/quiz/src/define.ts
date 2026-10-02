/**
 * Quiz definitions – the second container. A question is self-contained (question, answer
 * key or checker, hints, solution) and reusable on any page. If it refers to an applet, it
 * only knows the applet's id and reads its state from the channel; it never imports it.
 *
 * Text fields accept inline math `$f'(y^*) = 2 - a$`, display math `$$…$$` and `**bold**`.
 * Options and matching items may also be pictures: a plot of an applet in a given state, or
 * an image file (see `QuizImage`).
 */

import { threshold, type Checker, type Params } from '@abacus/applet-core'

/**
 * A picture in a question:
 * - `{ applet: 'logistic-cobweb', state: { a: 3.2 }, plot: 0 }` – that applet's plot (first by
 *   default) in that state, drawn by the plot library like in the applet itself;
 * - `{ src: 'bilder/zelle.png' }` – an image file under `site/public/` (SVG, PNG, JPG).
 */
export type QuizImage =
  | { applet: string; state?: Readonly<Record<string, unknown>>; plot?: number; alt?: string }
  | { src: string; alt?: string }

/** What an option or a matching item shows: text (with $math$) or a picture. */
export type Content = string | QuizImage

export const isImage = (c: Content): c is QuizImage => typeof c !== 'string'

interface Base {
  /** Stable for good: the notebook stores answers under it. */
  id: string
  question: string
  /** A picture under the question. */
  image?: QuizImage
  /** Applet whose live state the checker receives (course pages). */
  applet?: string
  /** A ladder of hints, one at a time (course pages). */
  hints?: readonly string[]
  /** Shown with the result. */
  solution?: string
  /** Bump when the question changes meaning, so old answers are not mixed with new ones. */
  version?: number
}

/** A prediction, committed before looking; not graded. */
export interface PredictionQuiz extends Base {
  type: 'prediction'
  /** Multiple choice; free text if omitted. */
  options?: readonly string[]
}

/** A value to find, typically in an applet, checked by a checker. */
export interface FindQuiz extends Base {
  type: 'find'
  /** The quantity, e.g. "$a$" or "$t^*$". */
  quantity: string
  unit?: string
  /** Stated to the student ("auf 0,05 genau"). */
  tolerance?: number
  checker?: Checker<any>
  /** now: immediate diagnosis · later: kept, confronted with the proof later · never: recorded only. */
  checking?: 'now' | 'later' | 'never'
}

/** Set the applet until a condition holds (course pages only). */
export interface ConfigureQuiz extends Base {
  type: 'configure'
  applet: string
  /** Receives the applet's current parameters and readouts. */
  checker: Checker<any>
}

/** An open answer in words. Not graded by the computer; compared with the model answer. */
export interface OpenQuiz extends Base {
  type: 'open'
  /** Shown after the answer is submitted, to compare with. */
  modelAnswer?: string
  /** What a good answer contains: shown with the model answer (and later a grading rubric). */
  criteria?: readonly string[]
}

/** One right option among several. */
export interface SingleChoiceQuiz extends Base {
  type: 'single'
  options: readonly Content[]
  /** Index into `options`. */
  correct: number
  /** A new order per attempt (default true); false keeps e.g. "keine davon" last. */
  shuffle?: boolean
}

/** Any number of right options, at least one. */
export interface MultipleChoiceQuiz extends Base {
  type: 'multiple'
  options: readonly Content[]
  /** Indices into `options`. */
  correct: readonly number[]
  shuffle?: boolean
}

/** Pairs to match: each left item gets its partner, dragged from all right items (plus distractors). */
export interface MatchQuiz extends Base {
  type: 'match'
  pairs: readonly (readonly [Content, Content])[]
  /** Right items that belong to no left item. */
  distractors?: readonly Content[]
}

/** A number, checked against a target. */
export interface NumberQuiz extends Base {
  type: 'number'
  target: number
  /** Absolute tolerance; default: exact to 6 significant digits. */
  tolerance?: number
  /** The quantity asked for, e.g. "$x_5$"; shown before the field. */
  quantity?: string
  unit?: string
}

export type QuizDef = PredictionQuiz | FindQuiz | ConfigureQuiz | OpenQuiz | SingleChoiceQuiz | MultipleChoiceQuiz | MatchQuiz | NumberQuiz
export type QuizType = QuizDef['type']

type FindInput = Omit<FindQuiz, 'checker'> & ({ checker: Checker<any>; target?: never } | { target: number; checker?: never } | { target?: never; checker?: never })

/** Defines a question. `{ type: 'find', target: 3, tolerance: 0.05 }` builds the `threshold` checker. */
export function defineQuiz<P extends Params = Params>(def: Exclude<QuizDef, FindQuiz> | FindInput): QuizDef {
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(def.id)) throw new Error(`Quiz id "${def.id}": letters, digits, '-' and '_' only.`)
  validate(def as QuizDef)
  if (def.type === 'find' && 'target' in def && def.target !== undefined) {
    const { target, ...rest } = def
    return { ...rest, checker: threshold<P>({ target, tolerance: def.tolerance ?? 0 }) }
  }
  return def as QuizDef
}

/** Catches authoring mistakes when the definitions load, naming the question. */
function validate(def: QuizDef): void {
  const fail = (m: string) => {
    throw new Error(`Quiz "${def.id}": ${m}`)
  }
  const key = (c: Content) => (typeof c === 'string' ? c : JSON.stringify(c))
  if (def.type === 'single') {
    if (def.options.length < 2) fail('at least two options.')
    if (!Number.isInteger(def.correct) || def.correct < 0 || def.correct >= def.options.length) fail('`correct` is not an index into `options`.')
  }
  if (def.type === 'multiple') {
    if (def.options.length < 2) fail('at least two options.')
    if (!def.correct.length) fail('at least one correct option.')
    if (def.correct.some((i) => !Number.isInteger(i) || i < 0 || i >= def.options.length)) fail('`correct` holds an index outside `options`.')
  }
  if (def.type === 'match') {
    if (def.pairs.length < 2) fail('at least two pairs.')
    const right = [...def.pairs.map((p) => key(p[1])), ...(def.distractors ?? []).map(key)]
    if (new Set(right).size !== right.length) fail('right items (and distractors) must differ.')
  }
  if (def.type === 'number' && !Number.isFinite(def.target)) fail('`target` is not a number.')
}

export * from './weekly'
export { AUTO_GRADED, answerText, correctAnswer, grade, isAnswered, rightItems, shuffleOrder, type Grade } from './grading'
