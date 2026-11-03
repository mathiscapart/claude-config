// Du workspace annoncé par `workspace.changed` (nom, branche) à son chemin sur le disque.
// Plusieurs workspaces peuvent porter le même nom et la même branche. Pour départager : un de ses
// terminaux (les ids de l'événement sont les handles d'`orca terminal list`), sinon `isActive` de
// `orca worktree ps` (le workspace actif enregistré par Orca, parfois en retard sur l'interface).
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const stripRef = b => (b ?? '').replace(/^refs\/heads\//, '')

/**
 * @param {{ displayName: string, branch: string, terminals: { id: string }[] }} context
 * @param {{ worktrees: { displayName: string, branch: string, path: string, isActive: boolean }[] }} ps `orca worktree ps`
 * @param {() => Promise<{ handle: string, worktreePath: string }[]>} terminals `orca terminal list`, lu seulement pour des homonymes
 * @returns {Promise<{ path: string|null, ambiguous: boolean }>} ambiguous : homonymes que rien ne départage (encore)
 */
export async function pickPath(context, ps, terminals) {
  const found = ps.worktrees.filter(w => w.displayName === context.displayName && stripRef(w.branch) === stripRef(context.branch))
  if (found.length <= 1) return { path: found[0]?.path ?? null, ambiguous: false }
  const ids = new Set(context.terminals.map(t => t.id))
  const term = ids.size ? (await terminals()).find(t => ids.has(t.handle) && found.some(w => w.path === t.worktreePath)) : null
  if (term) return { path: term.worktreePath, ambiguous: false }
  const active = found.find(w => w.isActive)
  return { path: active?.path ?? null, ambiguous: !active }
}

/** Le CLI d'Orca, livré à côté de l'exécutable qui fait tourner ce worker. */
function cliPath() {
  const bundled = join(dirname(process.execPath), 'resources', 'bin', process.platform === 'win32' ? 'orca.exe' : 'orca')
  return existsSync(bundled) ? bundled : 'orca'
}

// Le worker tourne sans APPDATA, dont le CLI a besoin pour trouver Orca sous Windows.
const cliEnv = () => ({ ...process.env, APPDATA: process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming') })

/** Lance `orca <args> --json` et renvoie `result`. */
export function orcaCli(...args) {
  return new Promise((resolve, reject) => {
    execFile(cliPath(), [...args, '--json'], { env: cliEnv(), windowsHide: true, timeout: 15_000, maxBuffer: 16 * 1024 * 1024 }, (err, out, errOut) => {
      if (err) return reject(new Error(`orca ${args.join(' ')} : ${String(errOut || out).trim().slice(0, 400)}`))
      try {
        resolve(JSON.parse(out).result)
      } catch (e) {
        reject(e)
      }
    })
  })
}
