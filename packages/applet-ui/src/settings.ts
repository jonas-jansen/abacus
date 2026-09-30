/**
 * Page settings for the person at this browser, e.g. quiet mode for teaching with a projector.
 * Stored in localStorage and mirrored as attributes on <html> (data-hinweise="aus"), so CSS
 * can react and the site can set them before the first paint.
 */

export const EINSTELLUNGEN = {
  /** hint cards on buttons and the plot (keys for zooming, …) */
  hinweise: { label: 'Hinweise beim Zeigen', text: 'kleine Erklärungen zu Knöpfen und Tasten' },
  /** the value box and crosshair that follow the pointer over a plot */
  werte: { label: 'Werte unter dem Mauszeiger', text: 'Kästchen mit den Werten der Kurven' },
} as const

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
  if (typeof document === 'undefined') return 'an'
  const attr = document.documentElement.dataset[name]
  if (attr === 'an' || attr === 'aus') return attr
  return read()[name] ?? 'an'
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
export const EINSTELLUNGEN_SCRIPT = `try{var s=JSON.parse(localStorage.getItem('${KEY}')||'{}');for(var k in s)document.documentElement.dataset[k]=s[k]}catch(e){}`
