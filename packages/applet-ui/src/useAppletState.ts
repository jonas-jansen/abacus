import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  decodeApplet,
  defaultParams,
  updateParams,
  writeApplet,
  type Observables,
  type Params,
  type Run,
} from '@abacus/applet-core'
import { publish, subscribe, type ObservableSnapshot } from '@abacus/channel'
import type { AppletDef } from './define'

export interface AppletState<P extends Params> {
  params: P
  /** Validated, merged and normalized centrally. */
  setParams: (patch: Readonly<Record<string, unknown>>) => void
  reset: () => void
  run: Run | null
  error: string | null
}

const snapshot = (o: Observables): Record<string, ObservableSnapshot> =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { label: v.label, kind: v.kind, value: v.value, note: v.note }]))

/**
 * Parameter state for one applet container. The opening state (`initialState`) is the base; the
 * URL hash holds only differences from it. State goes out on the channel as `applet/state`;
 * `applet/command` messages come in.
 */
export function useAppletState<P extends Params>(def: AppletDef<P>, initialState?: Readonly<Record<string, unknown>>): AppletState<P> {
  const { model } = def
  const initial = useMemo(() => updateParams(model, defaultParams(model), initialState ?? {}), [model, initialState])
  const [params, setState] = useState(initial)

  const setParams = useCallback((patch: Readonly<Record<string, unknown>>) => setState((prev) => updateParams(model, prev, patch)), [model])
  const reset = useCallback(() => setState(initial), [initial])

  // The hash is read only after hydration, so the server render and the first client render agree.
  useEffect(() => {
    const apply = () => {
      const patch = decodeApplet(window.location.hash, def.id, model.params)
      if (Object.keys(patch).length) setState(updateParams(model, initial, patch))
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [def.id, model, initial])

  // Write back, debounced: Safari throttles history.replaceState during slider drags.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const id = window.setTimeout(() => {
      const hash = writeApplet(window.location.hash, def.id, model.params, params, initial)
      const url = window.location.pathname + window.location.search + (hash ? '#' + hash : '')
      window.history.replaceState(window.history.state, '', url)
    }, 250)
    return () => window.clearTimeout(id)
  }, [def.id, model, params, initial])

  useEffect(
    () =>
      subscribe(
        'applet/command',
        (c) => {
          if (c.reset) reset()
          if (c.set) setParams(c.set)
        },
        { id: def.id, replay: false },
      ),
    [def.id, reset, setParams],
  )

  const { run, error } = useMemo(() => {
    try {
      return { run: model.run(params, def.runOptions?.(params) ?? {}), error: null }
    } catch (e) {
      return { run: null, error: e instanceof Error ? e.message : String(e) }
    }
  }, [model, params, def])

  useEffect(() => {
    if (run) publish('applet/state', { applet: def.id, params, observables: snapshot(run.observables) })
  }, [def.id, params, run])

  return { params, setParams, reset, run, error }
}
