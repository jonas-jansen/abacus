/**
 * Page settings for the person at this browser, e.g. quiet mode for teaching with a projector.
 * Stored in localStorage and mirrored as attributes on <html> (data-hinweise="aus"), so CSS
 * can react and the site can set them before the first paint.
 */

export const EINSTELLUNGEN = {
  /** hint cards on buttons and the plot (keys for zooming, …) */
  hinweise: { label: 'Hinweise beim Zeigen', text: 'kleine Erklärungen zu Knöpfen und Tasten', standard: 'an' },
  /** the value box and crosshair that follow the pointer over a plot */
  werte: { label: 'Werte unter dem Mauszeiger', text: 'Kästchen mit den Werten der Kurven', standard: 'aus' },
} as const satisfies Record<string, { label: string; text: string; standard: 'an' | 'aus' }>

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

/** For an inline <script> in <head>: applies the stored settings before the first paint. */
const STANDARD = JSON.stringify(Object.fromEntries(Object.entries(EINSTELLUNGEN).map(([k, e]) => [k, e.standard])))
export const EINSTELLUNGEN_SCRIPT = `(function(){var d=document.documentElement.dataset,s=${STANDARD},k;for(k in s)d[k]=s[k];try{var m=JSON.parse(localStorage.getItem('${KEY}')||'{}');for(k in m)d[k]=m[k]}catch(e){}})()`
