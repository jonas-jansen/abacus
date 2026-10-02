/**
 * The notebook (§9): every answer, prediction and found value, kept locally, exportable and
 * importable. Nothing is transmitted.
 *
 * Components talk to the `NotebookStore` interface only. Today the one implementation is
 * `localStorage`. If the site later moves behind Shibboleth and students want their notebook
 * on every device, a server-backed store (or a sync layer on top of this one) can implement
 * the same interface — note that this changes the privacy position in spec §2.
 */

import { useSyncExternalStore } from 'react'
import type { Diagnosis } from '@abacus/applet-core'
import type { QuizDef } from './define'

export type EntryType = QuizDef['type'] | 'sketch' | 'weekly'

export interface NotebookInput {
  value: unknown
  ts: number
  status: Diagnosis['status']
  /** The answer as readable text (an option's wording, a quiz attempt's score), for the notebook. */
  display?: string
}

export interface NotebookEntry {
  /** Schema version of this entry; bump when a problem is reworded to invalidate old answers. */
  v: number
  type: EntryType
  inputs: NotebookInput[]
  note?: string
  sketch?: string
  /** The question as posed, for the readable transcript. */
  question?: string
}

/** Answers belong to the quiz, not to the page: a quiz reused on another page shows the same answers. */
export interface NotebookScope {
  kurs: string
  semester: string
}

const PREFIX = 'vzms:'
const INDEX_KEY = 'vzms:index'

/** `vzms:<kurs>:<semester>:<quiz>` — quiz ids are author-assigned and stable, never positional. */
export const notebookKey = (s: NotebookScope, quiz: string) => `${PREFIX}${s.kurs}:${s.semester}:${quiz}`

export function parseKey(key: string): (NotebookScope & { quiz: string }) | null {
  const parts = key.slice(PREFIX.length).split(':')
  if (!key.startsWith(PREFIX) || parts.length !== 3) return null
  const [kurs, semester, quiz] = parts
  return { kurs, semester, quiz }
}

export interface NotebookStore {
  get(key: string): NotebookEntry | null
  /** Append one attempt; creates the entry if needed. All attempts are kept. */
  record(key: string, init: Pick<NotebookEntry, 'type' | 'v' | 'question'>, input: NotebookInput): NotebookEntry
  put(key: string, entry: NotebookEntry): void
  keys(): string[]
  clear(): void
  exportJson(): string
  /** Returns the number of entries imported. Throws on an unrecognised file. */
  importJson(json: string, mode?: 'merge' | 'replace'): number
  subscribe(listener: () => void): () => void
}

const FORMAT = 'abacus-notebook'
/** Files exported before the library spoke English; still imported. */
const OLD_FORMAT = 'abacus-notizbuch'

/** Statuses and field names of notebooks stored before the library spoke English. */
const OLD_STATUS: Record<string, Diagnosis['status']> = { richtig: 'correct', nah: 'close', falsch: 'wrong', gespeichert: 'saved' }
const OLD_TYPE: Record<string, EntryType> = {
  vorhersage: 'prediction', finde: 'find', erzeuge: 'configure', antwort: 'open', einfach: 'single', mehrfach: 'multiple', zuordnung: 'match', zahl: 'number', skizze: 'sketch', wochenquiz: 'weekly',
}

/** An entry as stored now, or converted from the earlier (German) format; null if neither. */
function asEntry(x: unknown): NotebookEntry | null {
  const e = x as Record<string, any>
  if (!e || typeof e !== 'object' || typeof e.v !== 'number') return null
  if (typeof e.type === 'string' && Array.isArray(e.inputs)) return e as NotebookEntry
  if (typeof e.typ === 'string' && Array.isArray(e.eingaben)) {
    return {
      v: e.v,
      type: OLD_TYPE[e.typ] ?? e.typ,
      inputs: e.eingaben.map((i: any) => ({ value: i.wert, ts: i.ts, status: OLD_STATUS[i.status] ?? i.status, display: i.anzeige })),
      note: e.notiz,
      sketch: e.skizze,
      question: e.frage,
    }
  }
  return null
}

/** `storage` null gives an in-memory notebook (server rendering, or storage blocked). */
export function createNotebook(storage: Storage | null): NotebookStore {
  const memory = new Map<string, string>()
  const read = (k: string): string | null => {
    try {
      return storage ? storage.getItem(k) : (memory.get(k) ?? null)
    } catch {
      return memory.get(k) ?? null
    }
  }
  const write = (k: string, v: string | null) => {
    try {
      if (storage) {
        if (v === null) storage.removeItem(k)
        else storage.setItem(k, v)
        return
      }
    } catch {
      // quota exceeded or storage blocked: keep working in memory for this session
    }
    if (v === null) memory.delete(k)
    else memory.set(k, v)
  }

  // useSyncExternalStore needs referentially stable snapshots.
  const cache = new Map<string, NotebookEntry | null>()
  const listeners = new Set<() => void>()
  const emit = () => {
    cache.clear()
    listeners.forEach((l) => l())
  }

  const keys = (): string[] => {
    try {
      const idx = JSON.parse(read(INDEX_KEY) ?? '[]')
      return Array.isArray(idx) ? idx.filter((k): k is string => typeof k === 'string') : []
    } catch {
      return []
    }
  }
  const setKeys = (ks: string[]) => write(INDEX_KEY, JSON.stringify([...new Set(ks)].sort()))

  const get = (key: string): NotebookEntry | null => {
    if (cache.has(key)) return cache.get(key)!
    let entry: NotebookEntry | null = null
    try {
      const parsed = JSON.parse(read(key) ?? 'null')
      entry = asEntry(parsed)
    } catch {
      entry = null
    }
    cache.set(key, entry)
    return entry
  }

  const put = (key: string, entry: NotebookEntry) => {
    write(key, JSON.stringify(entry))
    const ks = keys()
    if (!ks.includes(key)) setKeys([...ks, key])
    emit()
  }

  if (typeof window !== 'undefined' && storage) {
    window.addEventListener('storage', (e) => {
      if (e.key === null || e.key.startsWith(PREFIX)) emit()
    })
  }

  return {
    get,
    put,
    keys,
    record(key, init, input) {
      const prev = get(key)
      const entry: NotebookEntry =
        prev && prev.v === init.v
          ? { ...prev, question: init.question ?? prev.question, inputs: [...prev.inputs, input] }
          : { ...init, inputs: [input] }
      put(key, entry)
      return entry
    },
    clear() {
      for (const k of keys()) write(k, null)
      write(INDEX_KEY, null)
      emit()
    },
    exportJson() {
      const entries: Record<string, NotebookEntry> = {}
      for (const k of keys()) {
        const e = get(k)
        if (e) entries[k] = e
      }
      return JSON.stringify({ format: FORMAT, version: 2, exported: new Date().toISOString(), entries }, null, 2)
    },
    importJson(json, mode = 'merge') {
      const data = JSON.parse(json)
      const all = data?.format === FORMAT ? data.entries : data?.format === OLD_FORMAT ? data.eintraege : null
      if (!all || typeof all !== 'object') {
        throw new Error('Diese Datei ist kein exportiertes Notizbuch.')
      }
      if (mode === 'replace') for (const k of keys()) write(k, null)
      const ks = mode === 'replace' ? [] : keys()
      let n = 0
      for (const [k, e] of Object.entries(all as Record<string, unknown>)) {
        const entry = asEntry(e)
        if (!k.startsWith(PREFIX) || !entry) continue
        const prev = mode === 'merge' ? get(k) : null
        // Of two wordings of the same question, the newer one wins.
        if (prev && prev.v > entry.v) continue
        let merged = entry
        if (prev && prev.v === entry.v) {
          const seen = new Set(prev.inputs.map((x) => x.ts + ':' + JSON.stringify(x.value)))
          const extra = entry.inputs.filter((x) => !seen.has(x.ts + ':' + JSON.stringify(x.value)))
          merged = { ...entry, ...prev, inputs: [...prev.inputs, ...extra].sort((a, b) => a.ts - b.ts) }
        }
        write(k, JSON.stringify(merged))
        ks.push(k)
        n++
      }
      setKeys(ks)
      emit()
      return n
    },
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

let instance: NotebookStore | null = null

/** The page-wide notebook. Shared by all islands on a page (they share module instances). */
export function notebook(): NotebookStore {
  if (!instance) {
    let storage: Storage | null = null
    try {
      storage = typeof window !== 'undefined' ? window.localStorage : null
    } catch {
      storage = null
    }
    instance = createNotebook(storage)
  }
  return instance
}

export function useNotebookEntry(key: string): NotebookEntry | null {
  return useSyncExternalStore(
    (l) => notebook().subscribe(l),
    () => notebook().get(key),
    () => null,
  )
}

/** Readable transcript — "the letter home" (§9.2). */
export function exportMarkdown(store: NotebookStore): string {
  const fmt = (ts: number) => new Date(ts).toLocaleString('de-DE')
  const byPage = new Map<string, string[]>()
  for (const k of store.keys()) {
    const key = parseKey(k)
    const e = store.get(k)
    if (!key || !e) continue
    const lines = [`### ${e.question ?? key.quiz}`, '']
    const STATUS_TEXT: Record<string, string> = { correct: 'richtig', close: 'nah dran', wrong: 'falsch' }
    for (const x of e.inputs) {
      const text = x.display ?? (typeof x.value === 'string' ? x.value : JSON.stringify(x.value))
      lines.push(`- ${fmt(x.ts)}: ${text}${x.status === 'saved' ? '' : ` (${STATUS_TEXT[x.status] ?? x.status})`}`)
    }
    if (e.note) lines.push('', e.note)
    lines.push('')
    const page = `${key.kurs} · ${key.semester}`
    byPage.set(page, [...(byPage.get(page) ?? []), ...lines])
  }
  const out = ['# Mein Notizbuch', '']
  for (const [page, lines] of byPage) out.push(`## ${page}`, '', ...lines)
  return out.join('\n')
}
