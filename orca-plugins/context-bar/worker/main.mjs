// Surveille ~/.claude/projects et remesure la session active à chaque fin de tour.
import { watch } from 'node:fs'
import { sep } from 'node:path'

import { inspect, latestTranscript, measure, projectsDir } from './session.mjs'

const DEBOUNCE_MS = 1500

let watcher = null

/** @type {import('orca/worker').Activate} */
export default async function activate(orca) {
  /** Dernière lecture envoyée au panneau. */
  let state = { status: 'idle', reading: null, error: null, sessionId: null, cwd: null, at: null }
  let measured = null // `${sessionId}:${turnId}` déjà mesuré
  let running = false
  let again = false
  let timer = null

  const publish = patch => {
    state = { ...state, ...patch }
    orca.panels.post('context.changed', state)
  }

  async function refresh(force = false) {
    if (running) return void (again = true)
    const file = latestTranscript()
    if (!file) return publish({ status: 'idle', error: 'Aucune session Claude Code trouvée.' })
    const s = inspect(file)
    const key = `${s.sessionId}:${s.turnId}`
    if (!force && key === measured) return
    running = true
    publish({ status: 'loading', sessionId: s.sessionId, cwd: s.cwd })
    try {
      const reading = await measure(s)
      measured = key
      publish({ status: 'ready', reading, error: null, at: Date.now() })
    } catch (e) {
      orca.log(String(e))
      publish({ status: 'error', error: e.message })
    } finally {
      running = false
      if (again) {
        again = false
        void refresh()
      }
    }
  }

  // Seuls les transcripts principaux comptent : `<projet>/<session>.jsonl`, pas les sous-agents.
  watcher = watch(projectsDir(), { recursive: true }, (_event, name) => {
    if (!name || !name.endsWith('.jsonl') || name.split(sep).length !== 2) return
    clearTimeout(timer)
    timer = setTimeout(() => void refresh(), DEBOUNCE_MS)
  })

  orca.panels.handle('context.get', async () => {
    if (state.status === 'idle' && !state.reading) void refresh()
    return state
  })
  orca.panels.handle('context.refresh', async () => {
    void refresh(true)
    return state
  })
}

export function deactivate() {
  watcher?.close()
}
