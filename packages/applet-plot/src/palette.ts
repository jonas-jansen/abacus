/**
 * Palette and accessibility (§5.5). Series carry a role; colours come from CSS custom
 * properties `--abacus-<role>` (defined in applet-ui's stylesheet, with a dark variant),
 * so both render backends and the theme stay in one place.
 *
 * Every role also differs by dash pattern and marker shape, never by colour alone.
 * Deliberately blue / orange / purple — no red/green pairing.
 */

import type { SeriesRole } from '@abacus/applet-core'

export type Marker = 'circle' | 'square' | 'triangle' | 'diamond' | 'none'

export interface RoleStyle {
  width: number
  dash: readonly number[]
  marker: Marker
  alpha: number
}

export const roleStyles: Record<SeriesRole, RoleStyle> = {
  primary: { width: 2, dash: [], marker: 'circle', alpha: 1 },
  secondary: { width: 2, dash: [7, 4], marker: 'square', alpha: 1 },
  tertiary: { width: 2, dash: [2, 3], marker: 'triangle', alpha: 1 },
  reference: { width: 1.5, dash: [5, 4], marker: 'diamond', alpha: 1 },
  ghost: { width: 1.5, dash: [], marker: 'circle', alpha: 0.35 },
  annotation: { width: 1, dash: [], marker: 'none', alpha: 1 },
  grid: { width: 1, dash: [], marker: 'none', alpha: 1 },
  data: { width: 1, dash: [], marker: 'circle', alpha: 1 },
}

export const colorVar = (role: SeriesRole) => `--abacus-${role}`

/** Used when the custom property is missing (e.g. the stylesheet was not loaded). */
export const fallbackColors: Record<SeriesRole, string> = {
  primary: '#0b62a4',
  secondary: '#c2560b',
  tertiary: '#7a3b9e',
  reference: '#3a3a3a',
  ghost: '#6b7280',
  annotation: '#4b5563',
  grid: '#e5e7eb',
  data: '#1f2937',
}
