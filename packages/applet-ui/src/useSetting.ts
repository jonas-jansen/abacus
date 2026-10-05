/**
 * A page setting as React state: follows changes made in the settings while the page is open.
 * The first render uses the setting's default, as the server did (it knows no browser), so
 * hydration matches; the stored value takes over right after.
 */

import { useEffect, useState } from 'react'
import { einstellung, EINSTELLUNGEN, type Einstellung, type Wert } from './settings'

export function useSetting(name: Einstellung): Wert {
  const [value, setValue] = useState<Wert>(EINSTELLUNGEN[name].standard)
  useEffect(() => {
    const sync = () => setValue(einstellung(name))
    sync()
    document.addEventListener('abacus:einstellungen', sync)
    return () => document.removeEventListener('abacus:einstellungen', sync)
  }, [name])
  return value
}
