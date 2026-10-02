/**
 * The input for one question, by type – used on course pages and in weekly quizzes alike.
 * Controlled: the caller holds the answer. With `aufloesung` it shows what was right.
 */

import { useState } from 'react'
import { rechteSeite, mischung } from './bewertung'
import type { QuizDef } from './define'
import { Mathe } from './Mathe'

export interface AntwortfeldProps {
  def: QuizDef
  wert: unknown
  onWert: (v: unknown) => void
  /** Submitted: no more changes. */
  gesperrt?: boolean
  /** Mark right and wrong choices (after submitting, when solutions may show). */
  aufloesung?: boolean
  /** Seed of the option order (quiz id and attempt), so a reload shows the same order. */
  seed: string
}

const BUCHSTABEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function Antwortfeld(p: AntwortfeldProps) {
  switch (p.def.typ) {
    case 'einfach':
    case 'mehrfach':
      return <Auswahl {...p} def={p.def} />
    case 'zuordnung':
      return <Zuordnung {...p} def={p.def} />
    case 'zahl':
    case 'finde':
      return <Zahlfeld {...p} groesse={p.def.groesse} einheit={p.def.einheit} />
    case 'vorhersage':
      if (p.def.optionen) return <Auswahl {...p} def={{ ...p.def, typ: 'einfach', optionen: p.def.optionen, richtig: -1, mischen: false }} wertAlsText />
      return <Text {...p} zeilen={2} />
    default:
      return <Text {...p} zeilen={4} />
  }
}

/** Single or multiple choice. Options may be shuffled; the answer keeps definition indices. */
function Auswahl({
  def,
  wert,
  onWert,
  gesperrt,
  aufloesung,
  seed,
  wertAlsText = false,
}: Omit<AntwortfeldProps, 'def'> & { def: Extract<QuizDef, { typ: 'einfach' | 'mehrfach' }>; wertAlsText?: boolean }) {
  const mehrfach = def.typ === 'mehrfach'
  const reihe = def.mischen === false ? def.optionen.map((_, i) => i) : mischung(def.optionen.length, seed)
  const richtig = new Set(mehrfach ? def.richtig : [def.richtig])
  const gewaehlt = (i: number) =>
    mehrfach ? Array.isArray(wert) && (wert as number[]).includes(i) : wertAlsText ? wert === def.optionen[i] : wert === i
  const toggle = (i: number) => {
    if (gesperrt) return
    if (!mehrfach) return onWert(wertAlsText ? def.optionen[i] : i)
    const alt = Array.isArray(wert) ? (wert as number[]) : []
    onWert(alt.includes(i) ? alt.filter((x) => x !== i) : [...alt, i].sort((a, b) => a - b))
  }
  return (
    <div className="qz-options" role={mehrfach ? 'group' : 'radiogroup'} data-mehrfach={mehrfach || undefined}>
      {mehrfach && !gesperrt && <p className="qz-muted qz-small qz-anleitung">Mehrere Antworten können stimmen.</p>}
      {reihe.map((i) => {
        const an = gewaehlt(i)
        const marke = aufloesung ? (richtig.has(i) ? 'richtig' : an ? 'falsch' : undefined) : undefined
        return (
          <label key={i} data-active={an || undefined} data-marke={marke} data-gesperrt={gesperrt || undefined}>
            <input type={mehrfach ? 'checkbox' : 'radio'} checked={an} disabled={gesperrt} onChange={() => toggle(i)} />
            <Mathe text={def.optionen[i]} />
            {marke === 'richtig' && <span className="qz-marke" aria-label="richtig">✓</span>}
            {marke === 'falsch' && <span className="qz-marke" aria-label="falsch">✗</span>}
          </label>
        )
      })}
    </div>
  )
}

/**
 * Matching: click an item on the left, then its partner on the right (or the other way
 * round). Every left item gets one partner; choosing a partner taken elsewhere moves it.
 */
function Zuordnung({ def, wert, onWert, gesperrt, aufloesung, seed }: Omit<AntwortfeldProps, 'def'> & { def: Extract<QuizDef, { typ: 'zuordnung' }> }) {
  const rechts = rechteSeite(def)
  const reihe = mischung(rechts.length, seed)
  const wahl: (number | null)[] = Array.isArray(wert) ? (wert as (number | null)[]) : def.paare.map(() => null)
  const [aktivLinks, setAktivLinks] = useState<number | null>(null)
  const [aktivRechts, setAktivRechts] = useState<number | null>(null)
  const verbinde = (l: number, r: number) => {
    const neu = wahl.map((x) => (x === r ? null : x))
    neu[l] = wahl[l] === r ? null : r
    onWert(neu)
    setAktivLinks(null)
    setAktivRechts(null)
  }
  const links = (l: number) => {
    if (gesperrt) return
    if (aktivRechts !== null) return verbinde(l, aktivRechts)
    setAktivLinks(aktivLinks === l ? null : l)
  }
  const rechtsKlick = (r: number) => {
    if (gesperrt) return
    if (aktivLinks !== null) return verbinde(aktivLinks, r)
    setAktivRechts(aktivRechts === r ? null : r)
  }
  const partnerVon = (r: number) => wahl.findIndex((x) => x === r)
  return (
    <div className="qz-zuordnung">
      {!gesperrt && <p className="qz-muted qz-small qz-anleitung">Links anklicken, dann den passenden Partner rechts.</p>}
      <div className="qz-z-spalten">
        <ol className="qz-z-links">
          {def.paare.map(([text], l) => {
            const r = wahl[l]
            const ok = aufloesung ? r === l : undefined
            return (
              <li key={l}>
                <button type="button" className="qz-z-item" aria-pressed={aktivLinks === l} disabled={gesperrt} onClick={() => links(l)} data-marke={ok === undefined ? undefined : ok ? 'richtig' : 'falsch'}>
                  <span className="qz-z-nr">{BUCHSTABEN[l]}</span>
                  <Mathe text={text} />
                </button>
                {aufloesung && !ok && (
                  <span className="qz-z-loesung">
                    richtig: <Mathe text={rechts[l]} />
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <ul className="qz-z-rechts">
          {reihe.map((r) => {
            const l = partnerVon(r)
            return (
              <li key={r}>
                <button type="button" className="qz-z-item" aria-pressed={aktivRechts === r} disabled={gesperrt} onClick={() => rechtsKlick(r)} data-verbunden={l >= 0 || undefined}>
                  <span className="qz-z-nr" data-leer={l < 0 || undefined}>{l >= 0 ? BUCHSTABEN[l] : ''}</span>
                  <Mathe text={rechts[r]} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Zahlfeld({ wert, onWert, gesperrt, groesse, einheit }: Omit<AntwortfeldProps, 'def' | 'seed'> & { groesse?: string; einheit?: string }) {
  return (
    <label className="qz-field">
      {groesse && (
        <>
          <Mathe text={groesse} className="qz-var" />
          <span>=</span>
        </>
      )}
      <input type="text" inputMode="decimal" value={typeof wert === 'string' ? wert : wert === undefined || wert === null ? '' : String(wert)} disabled={gesperrt} onChange={(e) => onWert(e.target.value)} aria-label={groesse ? undefined : 'Ihre Zahl'} />
      {einheit && <span className="qz-muted">{einheit}</span>}
    </label>
  )
}

function Text({ wert, onWert, gesperrt, zeilen }: Omit<AntwortfeldProps, 'def' | 'seed'> & { zeilen: number }) {
  return <textarea className="qz-text" value={typeof wert === 'string' ? wert : ''} onChange={(e) => onWert(e.target.value)} rows={zeilen} disabled={gesperrt} aria-label="Ihre Antwort" />
}
