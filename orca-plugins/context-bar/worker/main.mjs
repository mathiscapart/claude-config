// Mesure la session suivie à chaque fin de tour, changement de session ou de workspace.
// Session suivie : celle épinglée dans le panneau, sinon (« Auto ») la plus récente du
// workspace ouvert dans Orca, sinon la plus récente tout court.
import { watch } from 'node:fs'
import { join, sep } from 'node:path'

import { inspect, latestTranscript, measure, projectSlug, projectsDir, recentSessions, transcriptOf } from './session.mjs'
import { orcaCli, pickPath } from './workspace.mjs'

const DEBOUNCE_MS = 1500

let watcher = null

/** @type {import('orca/worker').Activate} */
export default async function activate(orca) {
  let state = { status: 'idle', reading: null, error: null, sessionId: null, title: null, pinned: null, workspace: null }
  let focusDir = null // dossier Claude du workspace qui a le focus
  let measured = null // `${sessionId}:${turnId}` déjà mesuré
  let running = false
  let again = false
  let timer = null

  const publish = patch => {
    state = { ...state, ...patch }
    orca.panels.post('context.changed', state)
  }

  function target() {
    if (state.pinned) return transcriptOf(state.pinned)
    return (focusDir && latestTranscript(projectsDir(), focusDir)) || latestTranscript()
  }

  async function refresh(force = false) {
    if (running) return void (again = true)
    const file = target()
    if (!file) return publish({ status: 'idle', error: 'Aucune session Claude Code trouvée.' })
    const s = inspect(file)
    const key = `${s.sessionId}:${s.turnId}`
    if (!force && key === measured && s.sessionId === state.sessionId) {
      if (s.title !== state.title) publish({ title: s.title })
      return
    }
    running = true
    publish({ status: 'loading', sessionId: s.sessionId, title: s.title }) // l'ancienne lecture reste affichée jusqu'à la nouvelle
    try {
      const reading = await measure(s)
      // Session changée pendant la mesure (épinglage, focus) : résultat périmé, on remesure.
      if (target() !== file) again = true
      else {
        measured = key
        publish({ status: 'ready', reading, error: null })
      }
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

  // Le workspace qui a le focus → son chemin → le dossier où Claude range ses sessions.
  // (workspace.list n'existe qu'à partir de l'API hôte 1.3 : on passe par le CLI d'Orca.)
  const dirOf = path => join(projectsDir(), projectSlug(path))

  // `workspace.changed` part aussi à chaque renommage de terminal : les événements rapprochés sont
  // regroupés, seul le dernier contexte compte (une lecture de `orca worktree ps`, ~0,3 s).
  let latest = null
  let following = false
  let followAgain = false
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  async function follow() {
    if (following) return void (followAgain = true)
    following = true
    try {
      const context = latest
      if (!context) return // vue chat ou rien au premier plan : on garde le dernier workspace suivi
      let pick = { path: null, ambiguous: true }
      // Homonymes : isActive peut être en retard sur l'interface, on relit quelques fois.
      for (let i = 0; i < 4 && pick.ambiguous && context === latest; i++) {
        if (i) await sleep(700)
        const ps = await orcaCli('worktree', 'ps')
        pick = await pickPath(context, ps, async () => (await orcaCli('terminal', 'list')).terminals)
      }
      if (context === latest && pick.ambiguous) orca.log(`workspace ambigu (${context.displayName} sur ${context.branch}) : isActive ne tranche pas, on garde le précédent`)
      if (context !== latest || !pick.path) return // dépassé, inconnu ou indécidable : on garde l'ancien
      if (dirOf(pick.path) === focusDir) return
      focusDir = dirOf(pick.path) // remplacé seulement une fois le nouveau connu
      orca.log(`workspace suivi : ${pick.path}`)
      publish({ workspace: context.displayName })
      if (!state.pinned) void refresh()
    } catch (e) {
      orca.log(`workspace introuvable : ${e.message}`)
    } finally {
      following = false
      if (followAgain) {
        followAgain = false
        void follow()
      }
    }
  }

  const onWorkspace = context => {
    latest = context
    void follow()
  }
  orca.events.on('workspace.changed', ({ context }) => onWorkspace(context))
  // Relais du panneau : Orca n'envoie pas cet événement à un worker arrêté pour inactivité.
  orca.panels.handle('workspace.focus', async ({ context }) => {
    onWorkspace(context)
    return state
  })

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
  orca.panels.handle('sessions.list', async () => recentSessions())
  orca.panels.handle('session.pin', async ({ sessionId }) => {
    publish({ pinned: sessionId ?? null })
    void refresh()
    return state
  })
}

export function deactivate() {
  watcher?.close()
}
