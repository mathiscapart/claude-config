// Du workspace qui a le focus (nom, branche, terminaux) à son chemin sur le disque.
// Plusieurs workspaces peuvent porter le même nom et la même branche (« main ») :
// un terminal du workspace tranche, sinon celui qui a la session Claude la plus récente.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const stripRef = b => (b ?? '').replace(/^refs\/heads\//, '')

/**
 * @param {{ displayName: string, branch: string, terminals: { id: string }[] }} context
 * @param {{ displayName: string, branch: string, path: string }[]} worktrees `orca worktree list`
 * @param {() => Promise<{ handle: string, ptyId: string|null, worktreePath: string }[]>} terminals `orca terminal list`, lu seulement si nécessaire
 * @param {(path: string) => number} lastActivity date de la dernière session Claude de ce chemin (0 si aucune)
 */
export async function pickPath(context, worktrees, terminals, lastActivity) {
  const found = worktrees.filter(w => w.displayName === context.displayName && stripRef(w.branch) === stripRef(context.branch))
  if (found.length <= 1) return found[0]?.path ?? null
  const ids = new Set(context.terminals.map(t => t.id))
  const term = ids.size ? (await terminals()).find(t => ids.has(t.handle) || ids.has(t.ptyId)) : null
  if (term && found.some(w => w.path === term.worktreePath)) return term.worktreePath
  return found.reduce((a, b) => (lastActivity(b.path) > lastActivity(a.path) ? b : a)).path
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
