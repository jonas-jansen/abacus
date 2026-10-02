/**
 * Page settings for the person at this browser, e.g. quiet mode for teaching with a projector.
 * Stored in localStorage and mirrored as attributes on <html> (data-hinweise="aus"), so CSS
 * can react and the site can set them before the first paint.
 */

export const EINSTELLUNGEN = {
  /** hint cards on buttons and the plot (keys for zooming, …) */
  hinweise: { label: 'Hinweise beim Zeigen', standard: 'an' },
  /** the value box and crosshair that follow the pointer over a plot */
  werte: { label: 'Werte am Mauszeiger', standard: 'aus' },
} as const satisfies Record<string, { label: string; standard: 'an' | 'aus' }>

export type Einstellung = keyof typeof EINSTELLUNGEN
export type Wert = 'an' | 'aus'

const KEY = 'abacus:einstellungen'

function read(): Partial<Record<Einstellung, Wert>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

/** The current value; the <html> attribute wins, so a page can also set it itself. */
export function einstellung(name: Einstellung): Wert {
  if (typeof document === 'undefined') return EINSTELLUNGEN[name].standard
  const attr = document.documentElement.dataset[name]
  if (attr === 'an' || attr === 'aus') return attr
  return read()[name] ?? EINSTELLUNGEN[name].standard
}

export function setEinstellung(name: Einstellung, wert: Wert): void {
  const all = { ...read(), [name]: wert }
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // private mode: still applies to this page
  }
  document.documentElement.dataset[name] = wert
  document.dispatchEvent(new CustomEvent('abacus:einstellungen', { detail: all }))
}

/**
 * Light or dark: by default as the system says; chosen by hand, it is kept in this browser and
 * set as <html data-theme>, which the stylesheet follows.
 */
export type Farbe = 'auto' | 'hell' | 'dunkel'
export const FARBEN: readonly { wert: Farbe; label: string }[] = [
  { wert: 'auto', label: 'Automatisch' },
  { wert: 'hell', label: 'Hell' },
  { wert: 'dunkel', label: 'Dunkel' },
]
const FARBE_KEY = 'abacus:farbe'
const THEME: Record<Farbe, string | undefined> = { auto: undefined, hell: 'light', dunkel: 'dark' }

export function farbe(): Farbe {
  try {
    const f = localStorage.getItem(FARBE_KEY)
    if (f === 'hell' || f === 'dunkel') return f
  } catch {
    // no storage: automatic
  }
  return 'auto'
}

export function setFarbe(f: Farbe): void {
  try {
    if (f === 'auto') localStorage.removeItem(FARBE_KEY)
    else localStorage.setItem(FARBE_KEY, f)
  } catch {
    // private mode: still applies to this page
  }
  const t = THEME[f]
  if (t) document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
  document.dispatchEvent(new CustomEvent('abacus:farbe'))
}

/**
 * Calls back whenever the colours change – chosen here or by the system – e.g. to redraw a
 * canvas, which does not follow the stylesheet by itself.
 */
export function onFarbwechsel(cb: () => void): () => void {
  const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  document.addEventListener('abacus:farbe', cb)
  mq?.addEventListener('change', cb)
  return () => {
    document.removeEventListener('abacus:farbe', cb)
    mq?.removeEventListener('change', cb)
  }
}

/** For an inline <script> in <head>: applies the stored settings before the first paint. */
const STANDARD = JSON.stringify(Object.fromEntries(Object.entries(EINSTELLUNGEN).map(([k, e]) => [k, e.standard])))
export const EINSTELLUNGEN_SCRIPT = `(function(){var d=document.documentElement.dataset,s=${STANDARD},k;for(k in s)d[k]=s[k];try{var m=JSON.parse(localStorage.getItem('${KEY}')||'{}');for(k in m)d[k]=m[k];var f=localStorage.getItem('${FARBE_KEY}');if(f==='hell')d.theme='light';if(f==='dunkel')d.theme='dark'}catch(e){}})()`
