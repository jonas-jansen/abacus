/**
 * Tools for the lecture hall, in the applet's toolbar:
 *   - lecture mode: the applet alone on the whole screen, drawn larger (+ and − adjust);
 *   - the link as a QR code, so students open exactly this state on their phones;
 *   - one list of every gesture and key, which the hint cards otherwise show one at a time.
 */

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import qrcode from 'qrcode-generator'
import { renderTip } from './tip'

const ZOOM_MIN = 1
const ZOOM_MAX = 3
/** A first guess from the screen's size; the fit below then shrinks it until nothing scrolls. */
const passend = () => Math.min(2.5, Math.max(ZOOM_MIN, Math.round(Math.min(innerWidth / 1180, innerHeight / 700) * 20) / 20))

/**
 * Lecture mode: full screen for the applet (or, where a browser has no full screen, a layer
 * over the page), scaled by `zoom`. Esc ends it; + and − change the size, 0 fits it again.
 */
export function useVortrag(root: RefObject<HTMLElement | null>) {
  const [an, setAn] = useState(false)
  const [zoom, setZoom] = useState(1)
  // fitting to the screen until a size is chosen with + or −
  const [anpassen, setAnpassen] = useState(true)
  const fit = () => {
    setAnpassen(true)
    setZoom(passend())
  }
  useEffect(() => {
    const sync = () => {
      const on = !!root.current && document.fullscreenElement === root.current
      if (on) fit()
      setAn(on)
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [root])
  // Plots take their size from the width, so the height only shows after a layout: step down
  // until the applet fits the screen without scrolling.
  useEffect(() => {
    if (!an || !anpassen || zoom <= ZOOM_MIN) return
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        const el = root.current
        if (el && el.scrollHeight > el.clientHeight + 1) setZoom((z) => Math.max(ZOOM_MIN, Math.round(z * 20 - 1) / 20))
      })
    })
    return () => cancelAnimationFrame(id)
  }, [an, anpassen, zoom, root])
  useEffect(() => {
    if (!an) return
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      // a size chosen by hand stays, even if it scrolls
      const groesser = (d: number) => {
        setAnpassen(false)
        setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10 + d) / 10)))
      }
      if (e.key === '+' || e.key === '=') groesser(1)
      else if (e.key === '-') groesser(-1)
      else if (e.key === '0') fit()
      else if (e.key === 'Escape' && !document.fullscreenElement) setAn(false)
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [an])

  const start = async () => {
    const el = root.current
    if (!el) return
    try {
      await el.requestFullscreen()
    } catch {
      fit()
      setAn(true)
    }
  }
  const ende = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else setAn(false)
  }
  return { an, zoom, start, ende }
}

export function VortragKnopf({ an, onClick }: { an: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="ab-tool"
      aria-pressed={an}
      onClick={onClick}
      data-tip={an ? '{Esc} | Vortrag beenden\n{Plus} {Minus} | größer, kleiner' : 'Vortrag: das Applet groß auf dem ganzen Bildschirm'}
      aria-label={an ? 'Vortrag beenden' : 'Vortrag'}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        {an ? (
          <path d="M6 2.5v3.5H2.5M10 2.5v3.5h3.5M6 13.5V10H2.5M10 13.5V10h3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M2 2.5h12v8H2zM8 10.5v3M5.5 13.5h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  )
}

/** A modal card; a click beside it or Esc closes it. */
function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="ab-dialog" aria-label={title} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ab-dialog-head">
        <h3 className="ab-section-title">{title}</h3>
        <button type="button" className="ab-dialog-close" onClick={onClose} aria-label="schließen">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && children}
    </dialog>
  )
}

/** The QR code of a text as one SVG path, dark on white whatever the theme. */
function Qr({ text }: { text: string }) {
  const q = qrcode(0, 'M')
  q.addData(text, 'Byte')
  q.make()
  const n = q.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`
  return (
    <svg className="ab-qr" viewBox={`0 0 ${n + 8} ${n + 8}`} role="img" aria-label="QR-Code des Links" shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}

export function QrKnopf() {
  const [url, setUrl] = useState<string | null>(null)
  const open = async () => {
    // the hash is written with a short delay after the last change
    await new Promise((r) => setTimeout(r, 300))
    setUrl(window.location.href)
  }
  return (
    <>
      <button type="button" className="ab-tool" onClick={open} data-tip="Link als QR-Code: mit dem Handy genau diesen Zustand öffnen" aria-label="QR-Code zeigen">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M9.5 9.5h1.6v1.6H9.5zM12 12h1.6v1.6H12zM12 9.5h1.6M9.5 12.4v1.2" fill="currentColor" stroke="currentColor" strokeWidth="0.6" />
        </svg>
      </button>
      <Dialog open={url !== null} onClose={() => setUrl(null)} title="Mit dem Handy öffnen">
        {url && (
          <div className="ab-qr-body">
            <Qr text={url} />
            <p className="ab-qr-url">{url.replace(/^https?:\/\//, '').replace(/#.*/, '')}</p>
            <p className="ab-dialog-note">mit genau diesen Einstellungen</p>
          </div>
        )}
      </Dialog>
    </>
  )
}

/** Rows of keys and gestures, in the hint cards' markup. */
function Tasten({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) renderTip(src, ref.current)
  }, [src])
  return <div ref={ref} className="ab-tasten" />
}

export function HilfeKnopf({ bahnen, zeitleiste }: { bahnen: boolean; zeitleiste: boolean }) {
  const [open, setOpen] = useState(false)
  const gruppen: [string, string][] = [
    [
      'Bilder',
      [
        '{Mod} + {Rad} | zoomen',
        '{Finger} | zoomen mit zwei Fingern',
        '{Shift} + {Ziehen} | verschieben',
        '{Doppelklick} | zurück zum ganzen Bild',
        '{Ziehen} | Punkte im Bild ziehen: Parameter ändern',
        ...(bahnen ? ['Klick | in die Phasenebene: eine weitere Bahn'] : []),
        'Klick | auf die Legende: Kurve aus- und einblenden',
      ].join('\n'),
    ],
    ['Zahlen', '{Ziehen} | Zahl seitwärts ziehen: Wert ändern\nKlick | Zahl eintippen\nKlick | auf einen Messwert: im Bild markieren'],
    ...(zeitleiste
      ? ([['Zeitleiste', '{Leer} | abspielen, anhalten\nKlick | Tempo: ½× · 1× · 2× · 4×\n{Ziehen} | Tempo stufenlos, 0,1× bis 10×']] as [string, string][])
      : []),
    ['Verlauf', '{Mod} + {Z} | rückgängig\n{Redo} | wiederholen'],
    ['Vortrag', '{Plus} {Minus} | größer, kleiner\n{Null} | passend zum Bildschirm\n{Esc} | beenden'],
  ]
  return (
    <>
      <button type="button" className="ab-tool" onClick={() => setOpen(true)} data-tip="alle Gesten und Tasten" aria-label="Bedienung">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6.3 6.4a1.75 1.75 0 1 1 2.4 1.6c-.45.2-.7.55-.7 1.05v.35" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="11.3" r="0.85" fill="currentColor" />
        </svg>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Bedienung">
        <div className="ab-hilfe-gruppen">
          {gruppen.map(([titel, src]) => (
            <section key={titel}>
              <h4>{titel}</h4>
              <Tasten src={src} />
            </section>
          ))}
        </div>
      </Dialog>
    </>
  )
}
