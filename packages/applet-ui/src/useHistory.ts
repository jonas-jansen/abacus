import { useCallback, useEffect, useRef, useState } from 'react'
import type { Params } from '@abacus/applet-core'

/** A change settles after this long without further changes: one drag is one step. */
const SETTLE_MS = 400
const MAX_STEPS = 100

/**
 * Undo and redo for an applet's parameters. States are recorded once they settle, so a whole
 * drag or a burst of arrow keys is one step, not a hundred.
 */
export function useHistory<P extends Params>(params: P, apply: (p: P) => void) {
  const past = useRef<P[]>([])
  const future = useRef<P[]>([])
  const committed = useRef(params)
  const restoring = useRef(false)
  const [, bump] = useState(0)

  useEffect(() => {
    if (restoring.current) {
      restoring.current = false
      committed.current = params
      return
    }
    if (params === committed.current) return
    const id = window.setTimeout(() => {
      past.current = [...past.current, committed.current].slice(-MAX_STEPS)
      future.current = []
      committed.current = params
      bump((n) => n + 1)
    }, SETTLE_MS)
    return () => window.clearTimeout(id)
  }, [params])

  const undo = useCallback(() => {
    // a change still settling counts as the last step
    const current = params
    const target = current !== committed.current ? committed.current : past.current.at(-1)
    if (!target) return
    if (current === committed.current) past.current = past.current.slice(0, -1)
    future.current = [current, ...future.current]
    restoring.current = true
    apply(target)
    bump((n) => n + 1)
  }, [params, apply])

  const redo = useCallback(() => {
    const [target, ...rest] = future.current
    if (!target) return
    past.current = [...past.current, params]
    future.current = rest
    restoring.current = true
    apply(target)
    bump((n) => n + 1)
  }, [params, apply])

  return {
    undo,
    redo,
    canUndo: past.current.length > 0 || params !== committed.current,
    canRedo: future.current.length > 0,
  }
}
