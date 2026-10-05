/** A page setting as React state: follows changes made in the settings while the page is open. */

import { useEffect, useState } from 'react'
import { einstellung, type Einstellung, type Wert } from './settings'

export function useSetting(name: Einstellung): Wert {
  const [value, setValue] = useState<Wert>(() => einstellung(name))
  useEffect(() => {
    const sync = () => setValue(einstellung(name))
    sync()
    document.addEventListener('abacus:einstellungen', sync)
    return () => document.removeEventListener('abacus:einstellungen', sync)
  }, [name])
  return value
}
