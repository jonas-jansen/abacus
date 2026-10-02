/**
 * A weekly quiz: start, answer all questions (kept as a draft across reloads), submit, see the
 * result – as far as the quiz's rules allow – and try again if attempts are left. Every
 * attempt is recorded in the notebook under `wq-<id>`.
 */

import { useEffect, useMemo, useState } from 'react'
import { formatNumber } from '@abacus/applet-core'
import { AnswerField } from './AnswerField'
import { ImageView } from './Content'
import type { QuizDef } from './define'
import { AUTO_GRADED, correctAnswer, grade, isAnswered, type Grade } from './grading'
import { MathText } from './MathText'
import { notebook, notebookKey, useNotebookEntry, type NotebookInput, type NotebookScope } from './notebook'
import { ModelAnswer, StatusBadge, TYPE_LABEL, Verdict } from './QuizView'
import { dateText, phase, solutionsVisible, type WeeklyQuiz } from './weekly'

/** One submitted attempt, as stored in the notebook. */
export interface Attempt {
  n: number
  started: number
  answers: Record<string, unknown>
  grades: Record<string, Grade>
  points: number
  max: number
}

interface Draft {
  n: number
  started: number
  answers: Record<string, unknown>
}

export const weeklyQuizKey = (scope: NotebookScope, id: string) => notebookKey(scope, `wq-${id}`)
const draftKey = (scope: NotebookScope, id: string) => `abacus:wq-draft:${scope.kurs}:${scope.semester}:${id}`

const round2 = (x: number) => Math.round(x * 100) / 100
const pointsText = (p: number, max: number) => `${formatNumber(round2(p), 4)} von ${formatNumber(max, 4)}`

function readDraft(key: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? 'null')
    return d && typeof d.n === 'number' && d.answers ? d : null
  } catch {
    return null
  }
}
function writeDraft(key: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d))
    else localStorage.removeItem(key)
  } catch {
    // storage blocked: the draft lives as long as the page
  }
}

/** Attempts stored before the library spoke English (nr, begonnen, antworten …). */
function asAttempt(v: any): Attempt {
  if (v && typeof v.n === 'number') return v as Attempt
  const status: Record<string, Grade['status']> = { richtig: 'correct', nah: 'close', falsch: 'wrong', gespeichert: 'saved' }
  const grades: Record<string, Grade> = {}
  for (const [k, b] of Object.entries((v?.bewertungen ?? {}) as Record<string, any>)) grades[k] = { status: status[b.status] ?? b.status, points: b.punkte, max: b.max, hint: b.hinweis }
  return { n: v?.nr ?? 0, started: v?.begonnen ?? 0, answers: v?.antworten ?? {}, grades, points: v?.punkte ?? 0, max: v?.max ?? 0 }
}

/** The attempts of a weekly quiz in this browser, current version only. */
export function useAttempts(w: WeeklyQuiz, scope: NotebookScope): Attempt[] {
  const entry = useNotebookEntry(weeklyQuizKey(scope, w.id))
  return useMemo(() => (entry && entry.v === (w.version ?? 1) ? entry.inputs.map((e) => asAttempt(e.value)) : []), [entry, w.version])
}

/** The attempt that counts: the best or the last, as the quiz says. */
export function countingAttempt(w: WeeklyQuiz, attempts: readonly Attempt[]): Attempt | null {
  if (!attempts.length) return null
  if (w.counts === 'last') return attempts[attempts.length - 1]
  return attempts.reduce((a, b) => (b.points > a.points ? b : a))
}

/** "Now", set after mounting: the server render knows no time. */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** The rules in one line, German, e.g. "3 Versuche · Lösungen nach der Abgabe · es zählt der beste". */
export function rulesText(w: WeeklyQuiz): string {
  const parts = [
    w.attempts === undefined ? 'beliebig viele Versuche' : w.attempts === 1 ? 'ein Versuch' : `${w.attempts} Versuche`,
    { 'while-answering': 'Prüfen während der Bearbeitung', 'after-submit': 'Lösungen nach der Abgabe', 'after-close': 'Lösungen nach Ablauf der Frist' }[w.solutions ?? 'after-submit'],
  ]
  if ((w.attempts ?? 2) > 1) parts.push(w.counts === 'last' ? 'es zählt der letzte' : 'es zählt der beste')
  return parts.join(' · ')
}

/** The time window in one line, German. */
export function windowText(w: WeeklyQuiz): string | null {
  if (w.opens && w.closes) return `${dateText(w.opens)} bis ${dateText(w.closes)}`
  if (w.closes) return `bis ${dateText(w.closes)}`
  if (w.opens) return `ab ${dateText(w.opens)}`
  return null
}

export function WeeklyQuizView({ def: w, scope }: { def: WeeklyQuiz; scope: NotebookScope }) {
  const key = weeklyQuizKey(scope, w.id)
  const dKey = draftKey(scope, w.id)
  const attempts = useAttempts(w, scope)
  const now = useNow()
  const [draft, setDraftState] = useState<Draft | null>(null)
  const [shown, setShown] = useState<number | null>(null)
  useEffect(() => setDraftState(readDraft(dKey)), [dKey])
  const setDraft = (d: Draft | null) => {
    setDraftState(d)
    writeDraft(dKey, d)
  }

  if (now === null) return <section className="wq" aria-busy="true" />

  const ph = phase(w, now)
  const left = w.attempts === undefined ? Infinity : w.attempts - attempts.length
  const canStart = ph === 'open' && left > 0
  const visible = solutionsVisible(w, now)

  const start = () => setDraft({ n: attempts.length + 1, started: Date.now(), answers: {} })

  const submit = (d: Draft) => {
    const grades: Record<string, Grade> = {}
    let points = 0
    let max = 0
    for (const q of w.questions) {
      const g = grade(q, d.answers[q.id])
      grades[q.id] = g
      points += g.points
      max += g.max
    }
    const a: Attempt = { n: d.n, started: d.started, answers: d.answers, grades, points, max }
    const status: NotebookInput['status'] = max === 0 ? 'saved' : points >= max - 1e-9 ? 'correct' : points > 0 ? 'close' : 'wrong'
    const display = max ? `Versuch ${d.n}: ${pointsText(points, max)} Punkten` : `Versuch ${d.n}`
    notebook().record(key, { type: 'weekly', v: w.version ?? 1, question: `Quiz: ${w.title}` }, { value: a, ts: Date.now(), status, display })
    setDraft(null)
    setShown(null)
  }

  if (draft && ph === 'open') {
    return <Answering w={w} draft={draft} onAnswer={(id, v) => setDraft({ ...draft, answers: { ...draft.answers, [id]: v } })} onSubmit={() => submit(draft)} />
  }

  const show = shown !== null ? attempts.find((a) => a.n === shown) : attempts.at(-1)
  const counting = countingAttempt(w, attempts)

  return (
    <section className="wq">
      {ph === 'upcoming' && w.opens && <p className="wq-note">Dieses Quiz öffnet am {dateText(w.opens)}.</p>}
      {ph === 'closed' && <p className="wq-note">Die Frist ist abgelaufen{attempts.length ? '' : '; Sie haben keinen Versuch abgegeben'}.</p>}

      {attempts.length > 0 && (
        <div className="wq-attempts">
          <h2 className="wq-label">Ihre Versuche</h2>
          <ol>
            {attempts.map((a) => (
              <li key={a.n}>
                <button type="button" aria-pressed={show?.n === a.n} onClick={() => setShown(a.n)}>
                  <span>Versuch {a.n}</span>
                  <span className="qz-muted">{new Date(a.started).toLocaleDateString('de-DE')}</span>
                  <strong>{visible && a.max ? pointsText(a.points, a.max) : 'abgegeben'}</strong>
                  {visible && counting === a && attempts.length > 1 && <span className="wq-counts">zählt</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(canStart || ph === 'upcoming') && (
        <div className="wq-start">
          <button type="button" className="qz-btn qz-primary" disabled={!canStart} onClick={start}>
            {attempts.length ? 'Neuer Versuch' : 'Quiz starten'}
          </button>
          <span className="qz-muted qz-small">
            {w.questions.length} Fragen{left !== Infinity && attempts.length ? ` · noch ${left} ${left === 1 ? 'Versuch' : 'Versuche'}` : ''}
          </span>
        </div>
      )}
      {ph === 'open' && left <= 0 && <p className="qz-muted">Alle Versuche sind verbraucht.</p>}

      {show && <Result w={w} a={show} visible={visible} />}
    </section>
  )
}

function Answering({ w, draft, onAnswer, onSubmit }: { w: WeeklyQuiz; draft: Draft; onAnswer: (id: string, v: unknown) => void; onSubmit: () => void }) {
  const open = w.questions.filter((q) => !isAnswered(q, draft.answers[q.id])).length
  const [sure, setSure] = useState(false)
  return (
    <form
      className="wq wq-answering"
      onSubmit={(e) => {
        e.preventDefault()
        if (open && !sure) return setSure(true)
        onSubmit()
      }}
    >
      {w.questions.map((q, i) => (
        <Question
          key={q.id}
          q={q}
          n={i + 1}
          seed={`${w.id}:${draft.n}:${q.id}`}
          value={draft.answers[q.id]}
          onChange={(v) => onAnswer(q.id, v)}
          checkable={w.solutions === 'while-answering'}
        />
      ))}
      <div className="wq-submit">
        <span className="qz-muted">{open ? `${open} von ${w.questions.length} Fragen noch offen` : 'Alle Fragen beantwortet'}</span>
        {sure && open > 0 && <span className="wq-warning">Trotzdem abgeben? Offene Fragen zählen als falsch.</span>}
        <button type="submit" className="qz-btn qz-primary">
          {sure && open > 0 ? 'Ja, abgeben' : 'Abgeben'}
        </button>
      </div>
    </form>
  )
}

function QuestionHead({ q, n, status, points }: { q: QuizDef; n: number; status?: Grade['status']; points?: string }) {
  return (
    <header className="qz-head">
      <span className="qz-type">
        <span className="qz-nr">{n}</span>
        {TYPE_LABEL[q.type]}
      </span>
      {status && <StatusBadge status={status} text={points} final />}
    </header>
  )
}

/** One question while answering; in practice mode ("while-answering") with its own check. */
function Question({ q, n, seed, value, onChange, checkable }: { q: QuizDef; n: number; seed: string; value: unknown; onChange: (v: unknown) => void; checkable: boolean }) {
  const [g, setG] = useState<Grade | null>(null)
  return (
    <section className="qz wq-question" data-type={q.type}>
      <QuestionHead q={q} n={n} />
      <div className="qz-question">
        <MathText text={q.question} />
      </div>
      {q.image && <ImageView image={q.image} className="qz-question-image" />}
      <AnswerField
        def={q}
        value={value}
        onChange={(v) => {
          setG(null)
          onChange(v)
        }}
        seed={seed}
      />
      {checkable && AUTO_GRADED.has(q.type) && (
        <div className="qz-actions">
          <button type="button" className="qz-btn" disabled={!isAnswered(q, value)} onClick={() => setG(grade(q, value))}>
            Prüfen
          </button>
        </div>
      )}
      {g && <Verdict d={g} />}
    </section>
  )
}

/** A submitted attempt: score and, if allowed, every question with its solution. */
function Result({ w, a, visible }: { w: WeeklyQuiz; a: Attempt; visible: boolean }) {
  if (!visible) {
    return (
      <p className="wq-note">
        Versuch {a.n} ist abgegeben. Ergebnis und Lösungen erscheinen {w.closes ? `nach dem ${dateText(w.closes)}` : 'nach der Frist'}.
      </p>
    )
  }
  const ungraded = w.questions.filter((q) => !AUTO_GRADED.has(q.type)).length
  const share = a.max ? a.points / a.max : 0
  return (
    <div className="wq-result">
      <div className="wq-score" data-status={!a.max ? 'saved' : share >= 1 - 1e-9 ? 'correct' : share > 0 ? 'close' : 'wrong'}>
        <span className="wq-score-ring" style={{ '--share': share } as React.CSSProperties} aria-hidden="true" />
        <span>
          <strong>{a.max ? `${pointsText(a.points, a.max)} Punkten` : 'Abgegeben'}</strong>
          <span className="qz-muted">
            Versuch {a.n}
            {ungraded > 0 && ` · ${ungraded} offene ${ungraded === 1 ? 'Antwort' : 'Antworten'} ohne Punkte, zum Vergleich mit der Musterlösung`}
          </span>
        </span>
      </div>
      {w.questions.map((q, i) => {
        const g = a.grades[q.id]
        const graded = g && g.max > 0
        return (
          <section key={q.id} className="qz wq-question" data-status={graded ? g.status : undefined}>
            <QuestionHead q={q} n={i + 1} status={graded ? g.status : undefined} points={graded && g.status === 'close' ? `Teilweise · ${formatNumber(round2(g.points), 3)} Punkte` : undefined} />
            <div className="qz-question">
              <MathText text={q.question} />
            </div>
            {q.image && <ImageView image={q.image} className="qz-question-image" />}
            <AnswerField def={q} value={a.answers[q.id]} onChange={() => {}} locked reveal seed={`${w.id}:${a.n}:${q.id}`} />
            {g?.hint && <p className="qz-muted qz-small">{g.hint}</p>}
            {q.type === 'number' && g?.status !== 'correct' && (
              <p className="qz-small">
                Richtig: <MathText text={correctAnswer(q)!} />
              </p>
            )}
            {q.type === 'open' && (q.modelAnswer || q.criteria) && <ModelAnswer def={q} />}
            {q.solution && (
              <details className="qz-solution">
                <summary>Lösung</summary>
                <MathText text={q.solution} />
              </details>
            )}
          </section>
        )
      })}
    </div>
  )
}

/** A short status for lists: not started, submitted, the counting score. */
export function WeeklyQuizStatus({ def: w, scope }: { def: WeeklyQuiz; scope: NotebookScope }) {
  const attempts = useAttempts(w, scope)
  const now = useNow()
  if (now === null) return null
  const c = countingAttempt(w, attempts)
  const text = !attempts.length ? (phase(w, now) === 'open' ? 'noch nicht bearbeitet' : '') : !solutionsVisible(w, now) ? 'abgegeben' : c && c.max ? pointsText(c.points, c.max) + ' Punkten' : 'abgegeben'
  return text ? (
    <span className="wq-list-status" data-done={attempts.length > 0 || undefined}>
      {text}
    </span>
  ) : null
}
