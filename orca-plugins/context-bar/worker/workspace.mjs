// Du workspace annoncé par `workspace.changed` (nom, branche) à son chemin sur le disque.
// Plusieurs workspaces peuvent s'appeler « main » sur « main » : `isActive` de `orca worktree ps`
// (le workspace actif enregistré par Orca, parfois en retard sur l'interface) départage alors.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const stripRef = b => (b ?? '').replace(/^refs\/heads\//, '')

/**
 * @param {{ displayName: string, branch: string }} context
 * @param {{ worktrees: { displayName: string, branch: string, path: string, isActive: boolean }[] }} ps `orca worktree ps`
 * @returns {{ path: string|null, ambiguous: boolean }} ambiguous : homonymes qu'isActive ne départage pas (encore)
 */
export function pickPath(context, ps) {
  const found = ps.worktrees.filter(w => w.displayName === context.displayName && stripRef(w.branch) === stripRef(context.branch))
  if (found.length <= 1) return { path: found[0]?.path ?? null, ambiguous: false }
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
