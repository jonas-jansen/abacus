/**
 * The message channel between containers.
 *
 * Applets, quizzes and content are independent containers; they never import each other.
 * They talk only through these messages. Messages travel as `abacus:message` CustomEvents on
 * `window`, so anything on the page can take part — including scripts that are not part of
 * this code base: `window.addEventListener('abacus:message', e => console.log(e.detail))`.
 *
 * The last message per topic and key is retained, so a container that mounts late (lazy
 * hydration, content loaded afterwards) still sees the current state.
 */

export type Status = 'richtig' | 'nah' | 'falsch' | 'gespeichert'

export interface ObservableSnapshot {
  label: string
  kind: 'zahl' | 'index' | 'klasse' | 'liste'
  value: number | string | readonly number[] | null
  note?: string
}

export interface Messages {
  /** An applet's current parameters and observables. Sent after every change. */
  'applet/state': {
    applet: string
    params: Readonly<Record<string, unknown>>
    observables: Readonly<Record<string, ObservableSnapshot>>
  }
  /** Instructions to an applet. Any container may send them. */
  'applet/command': {
    applet: string
    /** Parameters to set; validated and normalized by the applet. */
    set?: Readonly<Record<string, unknown>>
    reset?: boolean
  }
  /** Show a locked applet (e.g. after a prediction was committed). Retained, so it survives reloads of the listener. */
  'applet/unlock': { applet: string }
  /** A quiz answer was committed. */
  'quiz/result': {
    quiz: string
    value: unknown
    status: Status
  }
}

export type Topic = keyof Messages
export type Envelope<T extends Topic = Topic> = { topic: T; msg: Messages[T] }

const EVENT = 'abacus:message'

const keyOf = (e: Envelope): string => {
  const m = e.msg as { applet?: string; quiz?: string }
  return `${e.topic}|${m.applet ?? m.quiz ?? ''}`
}

interface Store {
  retained: Map<string, Envelope>
}

// One store per window, even if several bundles each include this module.
function store(): Store {
  const w = (typeof window !== 'undefined' ? window : globalThis) as unknown as { __abacusChannel?: Store }
  w.__abacusChannel ??= { retained: new Map() }
  return w.__abacusChannel
}

export function publish<T extends Topic>(topic: T, msg: Messages[T]): void {
  const env = { topic, msg } as Envelope
  store().retained.set(keyOf(env), env)
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: env }))
}

/** The retained message for a topic and applet/quiz id, if any. */
export function last<T extends Topic>(topic: T, id: string): Messages[T] | undefined {
  return store().retained.get(`${topic}|${id}`)?.msg as Messages[T] | undefined
}

/**
 * Subscribe to a topic, optionally only for one applet/quiz id. With `replay` (default true)
 * retained messages are delivered immediately.
 */
export function subscribe<T extends Topic>(
  topic: T,
  handler: (msg: Messages[T]) => void,
  { id, replay = true }: { id?: string; replay?: boolean } = {},
): () => void {
  if (typeof window === 'undefined') return () => {}
  const matches = (env: Envelope) => {
    if (env.topic !== topic) return false
    const m = env.msg as { applet?: string; quiz?: string }
    return id === undefined || m.applet === id || m.quiz === id
  }
  if (replay) for (const env of store().retained.values()) if (matches(env)) handler(env.msg as Messages[T])
  const listener = (e: Event) => {
    const env = (e as CustomEvent<Envelope>).detail
    if (env && matches(env)) handler(env.msg as Messages[T])
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

/** For tests. */
export function resetChannel(): void {
  store().retained.clear()
}
