import { useRef, useState, useSyncExternalStore } from 'react'
import { formatNumber } from '@abacus/applet-core'
import { Mathe } from './Mathe'
import { exportMarkdown, notebook, parseKey } from './notebook'

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

/** Export / import / reset of the local notebook (§9.2). */
export function NotebookBar() {
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="qz-bar">
      <span className="qz-muted">Ihre Antworten bleiben auf diesem Gerät.</span>
      <button type="button" className="qz-btn" onClick={() => download(`notizbuch-${stamp()}.json`, 'application/json', notebook().exportJson())}>
        Exportieren
      </button>
      <button type="button" className="qz-btn" onClick={() => download(`notizbuch-${stamp()}.md`, 'text/markdown', exportMarkdown(notebook()))}>
        Als Text
      </button>
      <button type="button" className="qz-btn" onClick={() => file.current?.click()}>
        Importieren
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            setMsg(`${notebook().importJson(await f.text(), 'merge')} Einträge importiert.`)
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Import fehlgeschlagen.')
          }
        }}
      />
      <button
        type="button"
        className="qz-btn qz-danger"
        onClick={() => {
          if (window.confirm('Alle Antworten auf diesem Gerät löschen? Exportieren Sie vorher, wenn Sie sie behalten wollen.')) {
            notebook().clear()
            setMsg('Notizbuch geleert.')
          }
        }}
      >
        Zurücksetzen
      </button>
      {msg && <output className="qz-muted">{msg}</output>}
    </div>
  )
}

/** All recorded answers, newest quiz first. */
export function NotebookOverview() {
  const store = notebook()
  const keys = useSyncExternalStore(
    (l) => store.subscribe(l),
    () => store.keys().join('\n'),
    () => '',
  )
  const entries = keys
    .split('\n')
    .filter(Boolean)
    .flatMap((k) => {
      const key = parseKey(k)
      const e = store.get(k)
      return key && e ? [{ key, e }] : []
    })
    .sort((a, b) => (b.e.eingaben.at(-1)?.ts ?? 0) - (a.e.eingaben.at(-1)?.ts ?? 0))

  if (entries.length === 0) return <p className="qz-muted">Noch keine Einträge auf diesem Gerät.</p>

  return (
    <ul className="qz-notebook">
      {entries.map(({ key, e }) => (
        <li key={key.quiz}>
          <p className="qz-notebook-frage">
            <Mathe text={e.frage ?? key.quiz} />
          </p>
          <p className="qz-history">
            {e.eingaben.map((x, i) => (
              <span key={i} data-status={x.status}>
                {x.anzeige ? <Mathe text={x.anzeige} /> : typeof x.wert === 'number' ? formatNumber(x.wert, 8) : typeof x.wert === 'string' ? x.wert : 'Einstellung'}
              </span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  )
}
