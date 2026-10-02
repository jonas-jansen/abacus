/**
 * A weekly quiz: start, answer all questions (kept as a draft across reloads), submit, see the
 * result – as far as the quiz's rules allow – and try again if attempts are left. Every
 * attempt is recorded in the notebook under `wq-<id>`.
 */

import { useEffect, useMemo, useState } from 'react'
import { formatNumber } from '@abacus/applet-core'
import { Antwortfeld } from './Antwortfeld'
import { beantwortet, bewerte, PRUEFBAR, richtigeAntwort, type Bewertung } from './bewertung'
import type { QuizDef } from './define'
import { Mathe } from './Mathe'
import { notebook, notebookKey, useNotebookEntry, type Eingabe, type NotebookScope } from './notebook'
import { Muster, TYP_LABEL } from './QuizView'
import { datumText, loesungenSichtbar, phase, type Wochenquiz } from './wochenquiz'

/** One submitted attempt, as stored in the notebook. */
export interface Versuch {
  nr: number
  begonnen: number
  antworten: Record<string, unknown>
  bewertungen: Record<string, Bewertung>
  punkte: number
  max: number
}

interface Entwurf {
  nr: number
  begonnen: number
  antworten: Record<string, unknown>
}

export const wochenquizKey = (scope: NotebookScope, id: string) => notebookKey(scope, `wq-${id}`)
const entwurfKey = (scope: NotebookScope, id: string) => `abacus:wq-entwurf:${scope.kurs}:${scope.semester}:${id}`

const punkteText = (p: number, max: number) => `${formatNumber(Math.round(p * 100) / 100, 4)} von ${formatNumber(max, 4)}`

function leseEntwurf(key: string): Entwurf | null {
  try {
    const e = JSON.parse(localStorage.getItem(key) ?? 'null')
    return e && typeof e.nr === 'number' && e.antworten ? e : null
  } catch {
    return null
  }
}
function schreibeEntwurf(key: string, e: Entwurf | null) {
  try {
    if (e) localStorage.setItem(key, JSON.stringify(e))
    else localStorage.removeItem(key)
  } catch {
    // storage blocked: the draft lives as long as the page
  }
}

/** The attempts of a weekly quiz in this browser, current version only. */
export function useVersuche(w: Wochenquiz, scope: NotebookScope): Versuch[] {
  const entry = useNotebookEntry(wochenquizKey(scope, w.id))
  return useMemo(() => (entry && entry.v === (w.version ?? 1) ? entry.eingaben.map((e) => e.wert as Versuch) : []), [entry, w.version])
}

/** The attempt that counts: the best or the last, as the quiz says. */
export function wertung(w: Wochenquiz, versuche: readonly Versuch[]): Versuch | null {
  if (!versuche.length) return null
  if (w.wertung === 'letzte') return versuche[versuche.length - 1]
  return versuche.reduce((a, b) => (b.punkte > a.punkte ? b : a))
}

/** "Jetzt", set after mounting: the server render knows no time. */
function useJetzt(): number | null {
  const [jetzt, setJetzt] = useState<number | null>(null)
  useEffect(() => {
    setJetzt(Date.now())
    const id = window.setInterval(() => setJetzt(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return jetzt
}

export function regelnText(w: Wochenquiz): string {
  const teile = [
    w.versuche === undefined ? 'beliebig viele Versuche' : w.versuche === 1 ? 'ein Versuch' : `${w.versuche} Versuche`,
    { sofort: 'Prüfen während der Bearbeitung', nachAbgabe: 'Lösungen nach der Abgabe', nachFrist: 'Lösungen nach Ablauf der Frist' }[w.loesungen ?? 'nachAbgabe'],
  ]
  if ((w.versuche ?? 2) > 1) teile.push(w.wertung === 'letzte' ? 'es zählt der letzte' : 'es zählt der beste')
  return teile.join(' · ')
}

export function fensterText(w: Wochenquiz): string | null {
  if (w.ab && w.bis) return `${datumText(w.ab)} bis ${datumText(w.bis)}`
  if (w.bis) return `bis ${datumText(w.bis)}`
  if (w.ab) return `ab ${datumText(w.ab)}`
  return null
}

export function WochenquizView({ def: w, scope }: { def: Wochenquiz; scope: NotebookScope }) {
  const key = wochenquizKey(scope, w.id)
  const eKey = entwurfKey(scope, w.id)
  const versuche = useVersuche(w, scope)
  const jetzt = useJetzt()
  const [entwurf, setEntwurfState] = useState<Entwurf | null>(null)
  const [gewaehlt, setGewaehlt] = useState<number | null>(null)
  useEffect(() => setEntwurfState(leseEntwurf(eKey)), [eKey])
  const setEntwurf = (e: Entwurf | null) => {
    setEntwurfState(e)
    schreibeEntwurf(eKey, e)
  }

  if (jetzt === null) return <section className="wq" aria-busy="true" />

  const ph = phase(w, jetzt)
  const uebrig = w.versuche === undefined ? Infinity : w.versuche - versuche.length
  const kannStarten = ph === 'offen' && uebrig > 0
  const sichtbar = loesungenSichtbar(w, jetzt)

  const starten = () => setEntwurf({ nr: versuche.length + 1, begonnen: Date.now(), antworten: {} })

  const abgeben = (e: Entwurf) => {
    const bewertungen: Record<string, Bewertung> = {}
    let punkte = 0
    let max = 0
    for (const f of w.fragen) {
      const b = bewerte(f, e.antworten[f.id])
      bewertungen[f.id] = b
      punkte += b.punkte
      max += b.max
    }
    const v: Versuch = { nr: e.nr, begonnen: e.begonnen, antworten: e.antworten, bewertungen, punkte, max }
    const status: Eingabe['status'] = max === 0 ? 'gespeichert' : punkte >= max - 1e-9 ? 'richtig' : punkte > 0 ? 'nah' : 'falsch'
    const anzeige = max ? `Versuch ${e.nr}: ${punkteText(punkte, max)} Punkten` : `Versuch ${e.nr}`
    notebook().record(key, { typ: 'wochenquiz', v: w.version ?? 1, frage: `Quiz: ${w.titel}` }, { wert: v, ts: Date.now(), status, anzeige })
    setEntwurf(null)
    setGewaehlt(null)
  }

  // answering
  if (entwurf && ph === 'offen') {
    return <Bearbeitung w={w} entwurf={entwurf} onAntwort={(id, v) => setEntwurf({ ...entwurf, antworten: { ...entwurf.antworten, [id]: v } })} onAbgeben={() => abgeben(entwurf)} />
  }

  const zeige = gewaehlt !== null ? versuche.find((v) => v.nr === gewaehlt) : versuche.at(-1)
  const zaehlt = wertung(w, versuche)

  return (
    <section className="wq">
      {ph === 'bald' && w.ab && <p className="wq-hinweis">Dieses Quiz öffnet am {datumText(w.ab)}.</p>}
      {ph === 'vorbei' && <p className="wq-hinweis">Die Frist ist abgelaufen{versuche.length ? '' : '; Sie haben keinen Versuch abgegeben'}.</p>}

      {versuche.length > 0 && (
        <div className="wq-versuche">
          <h2 className="wq-titel-klein">Ihre Versuche</h2>
          <ol>
            {versuche.map((v) => (
              <li key={v.nr}>
                <button type="button" aria-pressed={zeige?.nr === v.nr} onClick={() => setGewaehlt(v.nr)}>
                  <span>Versuch {v.nr}</span>
                  <span className="qz-muted">{new Date(v.begonnen).toLocaleDateString('de-DE')}</span>
                  <strong>{sichtbar ? (v.max ? punkteText(v.punkte, v.max) : 'abgegeben') : 'abgegeben'}</strong>
                  {sichtbar && zaehlt === v && versuche.length > 1 && <span className="wq-zaehlt">zählt</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(kannStarten || ph === 'bald') && (
        <div className="wq-start">
          <button type="button" className="qz-btn qz-primary" disabled={!kannStarten} onClick={starten}>
            {versuche.length ? 'Neuer Versuch' : 'Quiz starten'}
          </button>
          <span className="qz-muted qz-small">
            {w.fragen.length} Fragen{uebrig !== Infinity && versuche.length ? ` · noch ${uebrig} ${uebrig === 1 ? 'Versuch' : 'Versuche'}` : ''}
          </span>
        </div>
      )}
      {ph === 'offen' && uebrig <= 0 && <p className="qz-muted">Alle Versuche sind verbraucht.</p>}

      {zeige && <Ergebnis w={w} v={zeige} sichtbar={sichtbar} />}
    </section>
  )
}

function Bearbeitung({ w, entwurf, onAntwort, onAbgeben }: { w: Wochenquiz; entwurf: Entwurf; onAntwort: (id: string, v: unknown) => void; onAbgeben: () => void }) {
  const offen = w.fragen.filter((f) => !beantwortet(f, entwurf.antworten[f.id])).length
  const [sicher, setSicher] = useState(false)
  return (
    <form
      className="wq wq-bearbeitung"
      onSubmit={(e) => {
        e.preventDefault()
        if (offen && !sicher) return setSicher(true)
        onAbgeben()
      }}
    >
      {w.fragen.map((f, i) => (
        <Frage key={f.id} f={f} nr={i + 1} seed={`${w.id}:${entwurf.nr}:${f.id}`} wert={entwurf.antworten[f.id]} onWert={(v) => onAntwort(f.id, v)} pruefen={(w.loesungen ?? 'nachAbgabe') === 'sofort'} />
      ))}
      <div className="wq-abgabe">
        <span className="qz-muted">{offen ? `${offen} von ${w.fragen.length} Fragen noch offen` : 'Alle Fragen beantwortet'}</span>
        {sicher && offen > 0 && <span className="wq-warnung">Trotzdem abgeben? Offene Fragen zählen als falsch.</span>}
        <button type="submit" className="qz-btn qz-primary">
          {sicher && offen > 0 ? 'Ja, abgeben' : 'Abgeben'}
        </button>
      </div>
    </form>
  )
}

/** One question while answering; in practice mode ("sofort") with its own check. */
function Frage({ f, nr, seed, wert, onWert, pruefen }: { f: QuizDef; nr: number; seed: string; wert: unknown; onWert: (v: unknown) => void; pruefen: boolean }) {
  const [b, setB] = useState<Bewertung | null>(null)
  return (
    <section className="qz wq-frage" data-typ={f.typ}>
      <header className="qz-head">
        <span className="qz-typ">
          <span className="qz-nr">{nr}</span>
          {TYP_LABEL[f.typ]}
        </span>
      </header>
      <div className="qz-frage">
        <Mathe text={f.frage} />
      </div>
      <Antwortfeld
        def={f}
        wert={wert}
        onWert={(v) => {
          setB(null)
          onWert(v)
        }}
        seed={seed}
      />
      {pruefen && PRUEFBAR.has(f.typ) && (
        <div className="qz-actions">
          <button type="button" className="qz-btn" disabled={!beantwortet(f, wert)} onClick={() => setB(bewerte(f, wert))}>
            Prüfen
          </button>
          {b && (
            <span className="qz-diagnose" data-status={b.status} role="status">
              <strong>{b.status === 'richtig' ? 'Stimmt.' : b.status === 'nah' ? 'Teilweise.' : 'Noch nicht.'}</strong> {b.richtung ? `Ihr Wert ist ${b.richtung}.` : (b.hinweis ?? '')}
            </span>
          )}
        </div>
      )}
    </section>
  )
}

/** A submitted attempt: score and, if allowed, every question with its solution. */
function Ergebnis({ w, v, sichtbar }: { w: Wochenquiz; v: Versuch; sichtbar: boolean }) {
  if (!sichtbar) {
    return (
      <p className="wq-hinweis">
        Versuch {v.nr} ist abgegeben. Ergebnis und Lösungen erscheinen {w.bis ? `nach dem ${datumText(w.bis)}` : 'nach der Frist'}.
      </p>
    )
  }
  const ungeprueft = w.fragen.filter((f) => !PRUEFBAR.has(f.typ)).length
  return (
    <div className="wq-ergebnis">
      <p className="wq-punkte">
        Versuch {v.nr}: <strong>{v.max ? punkteText(v.punkte, v.max) : '–'} Punkten</strong>
        {ungeprueft > 0 && <span className="qz-muted"> · {ungeprueft} offene {ungeprueft === 1 ? 'Antwort' : 'Antworten'} ohne Punkte, zum Vergleich mit der Musterlösung</span>}
      </p>
      {w.fragen.map((f, i) => {
        const b = v.bewertungen[f.id]
        return (
          <section key={f.id} className="qz wq-frage" data-status={b?.status}>
            <header className="qz-head">
              <span className="qz-typ">
                <span className="qz-nr">{i + 1}</span>
                {TYP_LABEL[f.typ]}
              </span>
              {b && b.max > 0 && <span className="wq-status" data-status={b.status}>{b.status === 'richtig' ? '✓' : b.status === 'nah' ? `${formatNumber(Math.round(b.punkte * 100) / 100, 3)} P.` : '✗'}</span>}
            </header>
            <div className="qz-frage">
              <Mathe text={f.frage} />
            </div>
            <Antwortfeld def={f} wert={v.antworten[f.id]} onWert={() => {}} gesperrt aufloesung seed={`${w.id}:${v.nr}:${f.id}`} />
            {b?.hinweis && <p className="qz-muted qz-small">{b.hinweis}</p>}
            {(f.typ === 'zahl' || f.typ === 'finde') && b?.status !== 'richtig' && richtigeAntwort(f) && (
              <p className="qz-small">
                Richtig: <Mathe text={richtigeAntwort(f)!} />
              </p>
            )}
            {f.typ === 'antwort' && (f.musterloesung || f.kriterien) && <Muster def={f} />}
            {f.loesung && (
              <details className="qz-loesung">
                <summary>Lösung</summary>
                <Mathe text={f.loesung} />
              </details>
            )}
          </section>
        )
      })}
    </div>
  )
}

/** A short status for lists: not started, running, best score. */
export function WochenquizStatus({ def: w, scope }: { def: Wochenquiz; scope: NotebookScope }) {
  const versuche = useVersuche(w, scope)
  const jetzt = useJetzt()
  if (jetzt === null) return null
  const z = wertung(w, versuche)
  const text = !versuche.length ? (phase(w, jetzt) === 'offen' ? 'noch nicht bearbeitet' : '') : !loesungenSichtbar(w, jetzt) ? 'abgegeben' : z && z.max ? punkteText(z.punkte, z.max) + ' Punkten' : 'abgegeben'
  return text ? <span className="wq-listenstatus" data-fertig={versuche.length > 0 || undefined}>{text}</span> : null
}
