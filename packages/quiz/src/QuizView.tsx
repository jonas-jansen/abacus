/**
 * One question on a course page. Renders any QuizDef, stores every attempt in the notebook,
 * and talks to the outside only through the channel: it reads `applet/state` for checking,
 * and sends `quiz/result` and – when asked to – `applet/unlock`.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { formatNumber, parseNumber, type Diagnosis, type Observables } from '@abacus/applet-core'
import { publish, subscribe, type Messages } from '@abacus/channel'
import { AnswerField } from './AnswerField'
import { ImageView } from './Content'
import type { FindQuiz, OpenQuiz, PredictionQuiz, QuizDef } from './define'
import { answerText, AUTO_GRADED, correctAnswer, grade, isAnswered } from './grading'
import { MathText } from './MathText'
import { notebook, notebookKey, useNotebookEntry, type NotebookInput, type NotebookScope } from './notebook'

export interface QuizViewProps {
  def: QuizDef
  scope: NotebookScope
  /** Number shown in the corner, e.g. "3". */
  number?: string | number
  /** A harder question. */
  star?: boolean
  /** Applet id to unlock once an answer is committed (prediction gate). */
  unlocks?: string
}

/** What each type is called on the page (German, for the students). */
export const TYPE_LABEL: Record<QuizDef['type'], string> = {
  prediction: 'Vorhersage',
  find: 'Finden',
  configure: 'Einstellen',
  open: 'Begründen',
  single: 'Auswahl',
  multiple: 'Mehrfachauswahl',
  match: 'Zuordnen',
  number: 'Rechnen',
}

const valueText = (w: unknown) =>
  typeof w === 'number' ? formatNumber(w, 8) : typeof w === 'string' ? w : w && typeof w === 'object' ? 'Einstellung' : String(w)

function useAppletState(appletId: string | undefined) {
  const [state, setState] = useState<Messages['applet/state'] | undefined>()
  useEffect(() => (appletId ? subscribe('applet/state', setState, { id: appletId }) : undefined), [appletId])
  return state
}

export function QuizView({ def, scope, number, star, unlocks }: QuizViewProps) {
  const key = notebookKey(scope, def.id)
  const stored = useNotebookEntry(key)
  // A reworded question (version bumped) starts afresh: old answers belong to the old wording.
  const entry = stored && stored.v === (def.version ?? 1) ? stored : null
  const applet = useAppletState(def.applet)
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const inputs = entry?.inputs ?? []
  const tried = inputs.length > 0

  // Re-announce a stored answer, so gates stay open across reloads.
  useEffect(() => {
    const last = entry?.inputs.at(-1)
    if (!last) return
    publish('quiz/result', { quiz: def.id, value: last.value, status: last.status })
    if (unlocks) publish('applet/unlock', { applet: unlocks })
  }, [entry, def.id, unlocks])

  const commit = (value: unknown, d: Diagnosis) => {
    notebook().record(key, { type: def.type, v: def.version ?? 1, question: def.question }, { value, ts: Date.now(), status: d.status, display: answerText(def, value) })
    setDiagnosis(d)
  }

  const context = (): { p: Messages['applet/state']['params']; o: Observables } => (applet ? { p: applet.params, o: applet.observables as Observables } : { p: {}, o: {} })
  const solution = def.solution ?? correctAnswer(def)

  return (
    <section className="qz" data-type={def.type} data-done={tried || undefined}>
      <header className="qz-head">
        <span className="qz-type">
          {number !== undefined && <span className="qz-nr">{number}</span>}
          {TYPE_LABEL[def.type]}
          {star && <span className="qz-star" title="schwieriger"> ★</span>}
        </span>
        {tried && def.type !== 'prediction' && <span className="qz-count">{inputs.length}× versucht</span>}
      </header>
      <div className="qz-question">
        <MathText text={def.question} />
      </div>
      {def.image && <ImageView image={def.image} className="qz-question-image" />}

      {def.type === 'prediction' && <Prediction def={def} last={inputs.at(-1)} onCommit={(w) => commit(w, { status: 'saved' })} />}

      {def.type === 'find' && (
        <Find
          def={def}
          onSubmit={(v) => {
            const mode = def.checking ?? 'now'
            if (mode !== 'now' || !def.checker) {
              commit(v, { status: 'saved', hint: mode === 'later' ? 'Wir kommen darauf zurück – beurteilen wird es der Beweis, nicht der Rechner.' : undefined })
              return
            }
            const { p, o } = context()
            commit(v, def.checker(v, p, o))
          }}
        />
      )}

      {def.type === 'configure' && (
        <div className="qz-actions">
          <button
            type="button"
            className="qz-btn qz-primary"
            disabled={!applet}
            onClick={() => applet && commit(applet.params, def.checker(applet.params, applet.params, applet.observables as Observables))}
          >
            Einstellung prüfen
          </button>
          {!applet && mounted && <span className="qz-muted">Das Applet „{def.applet}“ ist auf dieser Seite nicht geladen.</span>}
        </div>
      )}

      {def.type === 'open' && <Open last={inputs.at(-1)} onSave={(t) => commit(t, { status: 'saved' })} />}
      {def.type === 'open' && tried && (def.modelAnswer || def.criteria) && <ModelAnswer def={def} />}

      {AUTO_GRADED.has(def.type) && (
        <CheckNow
          def={def}
          seed={def.id}
          onCheck={(value) => {
            const g = grade(def, value)
            commit(value, { status: g.status, hint: g.hint, direction: g.direction })
          }}
        />
      )}

      {diagnosis && def.type !== 'prediction' && def.type !== 'open' && <Verdict d={diagnosis} />}

      {def.type === 'find' && inputs.length > 1 && (
        <p className="qz-history">
          Ihre Versuche:{' '}
          {inputs.map((e, i) => (
            <span key={i} data-status={e.status}>
              {valueText(e.value)}
            </span>
          ))}
        </p>
      )}

      {def.hints && def.hints.length > 0 && <Hints hints={def.hints} />}
      {solution &&
        (tried ? (
          <details className="qz-solution">
            <summary>Lösung</summary>
            <MathText text={solution} />
          </details>
        ) : (
          <p className="qz-muted qz-small">Die Lösung erscheint nach Ihrem ersten Versuch.</p>
        ))}
    </section>
  )
}

/**
 * Words of the verdict. While a retry follows (course pages, practice), "Noch nicht" invites the
 * next attempt; on a submitted attempt the verdict is final: "Falsch".
 */
const VERDICT: Record<Diagnosis['status'], string> = { correct: 'Richtig', close: 'Fast', wrong: 'Noch nicht', saved: 'Festgehalten' }
const FINAL: Record<Diagnosis['status'], string> = { correct: 'Richtig', close: 'Teilweise', wrong: 'Falsch', saved: 'Abgegeben' }
const DIRECTION: Record<NonNullable<Diagnosis['direction']>, string> = { 'too small': 'zu klein', 'too large': 'zu groß' }

/** The verdict on an answer: a badge, the direction for numbers, and the hint. */
export function Verdict({ d, points }: { d: Pick<Diagnosis, 'status' | 'hint' | 'direction'>; points?: string }) {
  return (
    <div className="qz-verdict" data-status={d.status} role="status">
      <StatusBadge status={d.status} text={points} />
      {(d.direction || d.hint) && (
        <span className="qz-verdict-text">
          {d.direction && <>Ihr Wert ist {DIRECTION[d.direction]}. </>}
          {d.hint && <MathText text={d.hint} />}
        </span>
      )}
    </div>
  )
}

/** "Richtig" with a check in a green circle, "Fast" in amber, "Noch nicht" in red. */
export function StatusBadge({ status, text, final = false }: { status: Diagnosis['status']; text?: string; final?: boolean }) {
  return (
    <span className="qz-badge" data-status={status}>
      <span className="qz-badge-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="12" height="12">
          {status === 'correct' && <path className="qz-tick" d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
          {status === 'wrong' && <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
          {status === 'close' && <path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
          {status === 'saved' && <circle cx="8" cy="8" r="2.5" fill="currentColor" />}
        </svg>
      </span>
      {text ?? (final ? FINAL : VERDICT)[status]}
    </span>
  )
}

function Prediction({ def, last, onCommit }: { def: PredictionQuiz; last?: NotebookInput; onCommit: (w: string) => void }) {
  const [value, setValue] = useState<unknown>('')
  if (last) {
    return (
      <p className="qz-committed">
        Ihre Vorhersage: <strong>{valueText(last.value)}</strong>
      </p>
    )
  }
  const text = typeof value === 'string' ? value.trim() : ''
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text) onCommit(text)
  }
  return (
    <form onSubmit={submit}>
      <AnswerField def={def} value={value} onChange={setValue} seed={def.id} />
      <div className="qz-actions">
        <button type="submit" className="qz-btn qz-primary" disabled={!text}>
          Festhalten
        </button>
        <span className="qz-muted qz-small">Danach lässt sie sich nicht mehr ändern.</span>
      </div>
    </form>
  )
}

function Find({ def, onSubmit }: { def: FindQuiz; onSubmit: (v: number) => void }) {
  const [text, setText] = useState<unknown>('')
  const [invalid, setInvalid] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = parseNumber(text)
    setInvalid(v === undefined)
    if (v !== undefined) onSubmit(v)
  }
  const now = (def.checking ?? 'now') === 'now'
  return (
    <form className="qz-find" onSubmit={submit}>
      <AnswerField def={def} value={text} onChange={setText} seed={def.id} />
      <button type="submit" className="qz-btn qz-primary" disabled={!String(text ?? '').trim()}>
        {now ? 'Prüfen' : 'Festhalten'}
      </button>
      {now && def.tolerance ? <span className="qz-muted qz-small">auf {formatNumber(def.tolerance)} genau</span> : null}
      {invalid && <span className="qz-small qz-invalid">Bitte eine Zahl, z. B. 3.2.</span>}
    </form>
  )
}

function Open({ last, onSave }: { last?: NotebookInput; onSave: (t: string) => void }) {
  const [text, setText] = useState<string | null>(null)
  const value = text ?? (typeof last?.value === 'string' ? last.value : '')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) {
          onSave(value)
          setText(null)
        }
      }}
    >
      <textarea className="qz-text" value={value} onChange={(e) => setText(e.target.value)} rows={3} aria-label="Ihre Antwort" />
      <div className="qz-actions">
        <button type="submit" className="qz-btn" disabled={text === null || !value.trim()}>
          Ins Notizbuch
        </button>
        {last && text === null && <span className="qz-muted qz-small">gespeichert</span>}
      </div>
    </form>
  )
}

function Hints({ hints }: { hints: readonly string[] }) {
  const [shown, setShown] = useState(0)
  return (
    <div className="qz-hints">
      {hints.slice(0, shown).map((t, i) => (
        <p key={i} className="qz-hint">
          <span className="qz-muted">Tipp {i + 1}:</span> <MathText text={t} />
        </p>
      ))}
      {shown < hints.length && (
        <button type="button" className="qz-link" onClick={() => setShown(shown + 1)}>
          {shown === 0 ? 'Tipp' : 'noch ein Tipp'}
        </button>
      )}
    </div>
  )
}

/** A question the computer checks at once: the field and a "Prüfen" button. */
function CheckNow({ def, seed, onCheck }: { def: QuizDef; seed: string; onCheck: (value: unknown) => void }) {
  const [value, setValue] = useState<unknown>(undefined)
  return (
    <form
      className="qz-check"
      onSubmit={(e) => {
        e.preventDefault()
        if (isAnswered(def, value)) onCheck(value)
      }}
    >
      <AnswerField def={def} value={value} onChange={setValue} seed={seed} />
      <div className="qz-actions">
        <button type="submit" className="qz-btn qz-primary" disabled={!isAnswered(def, value)}>
          Prüfen
        </button>
      </div>
    </form>
  )
}

/** The model answer and what a good answer contains, after an open answer is submitted. */
export function ModelAnswer({ def }: { def: OpenQuiz }) {
  return (
    <details className="qz-solution qz-model" open>
      <summary>Zum Vergleich</summary>
      {def.modelAnswer && <MathText text={def.modelAnswer} />}
      {def.criteria && def.criteria.length > 0 && (
        <>
          <p className="qz-muted qz-small">Eine gute Antwort enthält:</p>
          <ul className="qz-criteria">
            {def.criteria.map((k, i) => (
              <li key={i}>
                <MathText text={k} />
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}
