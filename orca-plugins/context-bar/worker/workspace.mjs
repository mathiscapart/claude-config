// Le workspace ouvert dans Orca et son chemin sur le disque.
// `workspace.changed` ne donne que nom, branche et terminaux : plusieurs workspaces s'appellent
// « main » sur « main ». `orca worktree ps` marque le seul ouvert dans l'interface (`isActive`).
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** @param {{ worktrees: { path: string, isActive: boolean }[] }} ps résultat de `orca worktree ps` */
export const activePath = ps => ps.worktrees.find(w => w.isActive)?.path ?? null

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
