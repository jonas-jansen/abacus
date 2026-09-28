/**
 * The quiz container. Renders any QuizDef, stores every attempt in the notebook, and talks to
 * the outside only through the channel: it reads `applet/state` for checking, and sends
 * `quiz/result` and — when asked to — `applet/unlock`.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { formatNumber, parseNumber, type Diagnose, type Observables } from '@abacus/applet-core'
import { publish, subscribe, type Messages } from '@abacus/channel'
import type { QuizDef } from './define'
import { Mathe } from './Mathe'
import { notebook, notebookKey, useNotebookEntry, type Eingabe, type NotebookScope } from './notebook'

export interface QuizViewProps {
  def: QuizDef
  scope: NotebookScope
  /** Number shown in the corner, e.g. "3". */
  nr?: string | number
  /** Harder problem. */
  stern?: boolean
  /** Applet id to unlock once an answer is committed (Vorhersage gate). */
  schaltetFrei?: string
}

const TYP_LABEL: Record<QuizDef['typ'], string> = {
  vorhersage: 'Vorhersage',
  finde: 'Finden',
  erzeuge: 'Einstellen',
  antwort: 'Begründen',
}

const STATUS_TEXT: Record<Diagnose['status'], string> = {
  richtig: 'Stimmt.',
  nah: 'Nah dran.',
  falsch: 'Noch nicht.',
  gespeichert: 'Festgehalten.',
}

const wertText = (w: unknown) =>
  typeof w === 'number' ? formatNumber(w, 8) : typeof w === 'string' ? w : w && typeof w === 'object' ? 'Einstellung' : String(w)

function useAppletState(appletId: string | undefined) {
  const [state, setState] = useState<Messages['applet/state'] | undefined>()
  useEffect(() => (appletId ? subscribe('applet/state', setState, { id: appletId }) : undefined), [appletId])
  return state
}

export function QuizView({ def, scope, nr, stern, schaltetFrei }: QuizViewProps) {
  const key = notebookKey(scope, def.id)
  const stored = useNotebookEntry(key)
  // A reworded question (version bumped) starts afresh: old answers belong to the old wording.
  const entry = stored && stored.v === (def.version ?? 1) ? stored : null
  const applet = useAppletState(def.applet)
  const [diagnose, setDiagnose] = useState<Diagnose | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const eingaben = entry?.eingaben ?? []
  const tried = eingaben.length > 0

  // Re-announce a stored answer, so gates stay open across reloads.
  useEffect(() => {
    const last = entry?.eingaben.at(-1)
    if (!last) return
    publish('quiz/result', { quiz: def.id, value: last.wert, status: last.status })
    if (schaltetFrei) publish('applet/unlock', { applet: schaltetFrei })
  }, [entry, def.id, schaltetFrei])

  const commit = (wert: unknown, d: Diagnose) => {
    notebook().record(key, { typ: def.typ, v: def.version ?? 1, frage: def.frage }, { wert, ts: Date.now(), status: d.status })
    setDiagnose(d)
  }

  const context = (): { p: Record<string, never>; o: Observables } | { p: Messages['applet/state']['params']; o: Observables } =>
    applet ? { p: applet.params, o: applet.observables as Observables } : { p: {}, o: {} }

  return (
    <section className="qz" data-typ={def.typ} data-done={tried || undefined}>
      <header className="qz-head">
        <span className="qz-typ">
          {nr !== undefined && <span className="qz-nr">{nr}</span>}
          {TYP_LABEL[def.typ]}
          {stern && <span className="qz-stern" title="schwieriger"> ★</span>}
        </span>
        {tried && def.typ !== 'vorhersage' && <span className="qz-count">{eingaben.length}× versucht</span>}
      </header>
      <p className="qz-frage">
        <Mathe text={def.frage} />
      </p>

      {def.typ === 'vorhersage' && <Vorhersage def={def} last={eingaben.at(-1)} onCommit={(w) => commit(w, { status: 'gespeichert' })} />}

      {def.typ === 'finde' && (
        <Finde
          def={def}
          onSubmit={(v) => {
            const mode = def.pruefung ?? 'sofort'
            if (mode !== 'sofort' || !def.pruefer) {
              commit(v, {
                status: 'gespeichert',
                hinweis: mode === 'spaeter' ? 'Wir kommen darauf zurück – beurteilen wird es der Beweis, nicht der Rechner.' : undefined,
              })
              return
            }
            const { p, o } = context()
            commit(v, def.pruefer(v, p, o))
          }}
        />
      )}

      {def.typ === 'erzeuge' && (
        <div className="qz-actions">
          <button
            type="button"
            className="qz-btn qz-primary"
            disabled={!applet}
            onClick={() => {
              if (!applet) return
              commit(applet.params, def.pruefer(applet.params, applet.params, applet.observables as Observables))
            }}
          >
            Einstellung prüfen
          </button>
          {!applet && mounted && <span className="qz-muted">Das Applet „{def.applet}“ ist auf dieser Seite nicht geladen.</span>}
        </div>
      )}

      {def.typ === 'antwort' && <Antwort last={eingaben.at(-1)} onSave={(t) => commit(t, { status: 'gespeichert' })} />}

      {diagnose && def.typ !== 'vorhersage' && <DiagnoseView d={diagnose} richtung={def.typ === 'finde'} />}

      {def.typ === 'finde' && eingaben.length > 1 && (
        <p className="qz-history">
          Ihre Versuche:{' '}
          {eingaben.map((e, i) => (
            <span key={i} data-status={e.status}>
              {wertText(e.wert)}
            </span>
          ))}
        </p>
      )}

      {def.tipps && def.tipps.length > 0 && <Tipps tipps={def.tipps} />}
      {def.loesung &&
        (tried ? (
          <details className="qz-loesung">
            <summary>Lösung</summary>
            <Mathe text={def.loesung} />
          </details>
        ) : (
          <p className="qz-muted qz-small">Die Lösung erscheint nach Ihrem ersten Versuch.</p>
        ))}
    </section>
  )
}

function DiagnoseView({ d, richtung = true }: { d: Diagnose; richtung?: boolean }) {
  return (
    <p className="qz-diagnose" data-status={d.status} role="status">
      <strong>{STATUS_TEXT[d.status]}</strong>
      {richtung && d.richtung && <> Ihr Wert ist {d.richtung}.</>}
      {d.hinweis && (
        <>
          {' '}
          <Mathe text={d.hinweis} />
        </>
      )}
    </p>
  )
}

function Vorhersage({ def, last, onCommit }: { def: Extract<QuizDef, { typ: 'vorhersage' }>; last?: Eingabe; onCommit: (w: string) => void }) {
  const [wert, setWert] = useState('')
  if (last) {
    return (
      <p className="qz-committed">
        Ihre Vorhersage: <strong>{wertText(last.wert)}</strong>
      </p>
    )
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (wert.trim()) onCommit(wert.trim())
  }
  return (
    <form onSubmit={submit}>
      {def.optionen ? (
        <div className="qz-options" role="radiogroup">
          {def.optionen.map((o) => (
            <label key={o} data-active={wert === o || undefined}>
              <input type="radio" name={def.id} value={o} checked={wert === o} onChange={() => setWert(o)} />
              <Mathe text={o} />
            </label>
          ))}
        </div>
      ) : (
        <textarea className="qz-text" value={wert} onChange={(e) => setWert(e.target.value)} rows={2} aria-label={def.frage} />
      )}
      <div className="qz-actions">
        <button type="submit" className="qz-btn qz-primary" disabled={!wert.trim()}>
          Festhalten
        </button>
        <span className="qz-muted qz-small">Danach lässt sie sich nicht mehr ändern.</span>
      </div>
    </form>
  )
}

function Finde({ def, onSubmit }: { def: Extract<QuizDef, { typ: 'finde' }>; onSubmit: (v: number) => void }) {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = parseNumber(text)
    setInvalid(v === undefined)
    if (v !== undefined) onSubmit(v)
  }
  const sofort = (def.pruefung ?? 'sofort') === 'sofort'
  return (
    <form className="qz-finde" onSubmit={submit}>
      <label className="qz-field">
        <Mathe text={def.groesse} className="qz-var" />
        <span>=</span>
        <input type="text" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={invalid || undefined} />
        {def.einheit && <span className="qz-muted">{def.einheit}</span>}
      </label>
      <button type="submit" className="qz-btn qz-primary" disabled={!text.trim()}>
        {sofort ? 'Prüfen' : 'Festhalten'}
      </button>
      {sofort && def.toleranz ? <span className="qz-muted qz-small">auf {formatNumber(def.toleranz)} genau</span> : null}
      {invalid && <span className="qz-small qz-invalid">Bitte eine Zahl, z. B. 3,2.</span>}
    </form>
  )
}

function Antwort({ last, onSave }: { last?: Eingabe; onSave: (t: string) => void }) {
  const [text, setText] = useState<string | null>(null)
  const value = text ?? (typeof last?.wert === 'string' ? last.wert : '')
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

function Tipps({ tipps }: { tipps: readonly string[] }) {
  const [shown, setShown] = useState(0)
  return (
    <div className="qz-tipps">
      {tipps.slice(0, shown).map((t, i) => (
        <p key={i} className="qz-tipp">
          <span className="qz-muted">Tipp {i + 1}:</span> <Mathe text={t} />
        </p>
      ))}
      {shown < tipps.length && (
        <button type="button" className="qz-link" onClick={() => setShown(shown + 1)}>
          {shown === 0 ? 'Tipp' : 'noch ein Tipp'}
        </button>
      )}
    </div>
  )
}
