// Trouve la session Claude Code active et la mesure avec `/context`, sans appel au modèle.
import { spawn } from 'node:child_process'
import { openSync, readSync, closeSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

import { parseContext } from './parse.mjs'

export const projectsDir = () => join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects')

/** Le transcript principal (`<projet>/<session>.jsonl`) écrit le plus récemment. */
export function latestTranscript(dir = projectsDir()) {
  let best = null
  for (const project of readdirSync(dir, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const pdir = join(dir, project.name)
    for (const f of readdirSync(pdir)) {
      if (!f.endsWith('.jsonl')) continue
      const file = join(pdir, f)
      const mtime = statSync(file).mtimeMs
      if (!best || mtime > best.mtime) best = { file, mtime }
    }
  }
  return best?.file ?? null
}

/** Les dernières lignes JSON du fichier (lit seulement la fin). */
function tailLines(file, bytes = 256 * 1024) {
  const fd = openSync(file, 'r')
  try {
    const size = statSync(file).size
    const len = Math.min(size, bytes)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, size - len)
    const lines = buf.toString('utf8').split('\n')
    if (len < size) lines.shift() // ligne coupée
    return lines.flatMap(l => {
      try { return l.trim() ? [JSON.parse(l)] : [] } catch { return [] }
    })
  } finally {
    closeSync(fd)
  }
}

/** { sessionId, cwd, turnId }: turnId = uuid de la dernière réponse finale, null si aucune. */
export function inspect(file) {
  const lines = tailLines(file)
  const cwd = lines.findLast(o => typeof o.cwd === 'string')?.cwd ?? null
  const turn = lines.findLast(o => o.type === 'assistant' && o.message?.stop_reason === 'end_turn')
  return { sessionId: basename(file, '.jsonl'), cwd, turnId: turn?.uuid ?? null }
}

/** Lance `claude -p /context` sur une copie éphémère de la session. */
export function measure({ sessionId, cwd }, { signal, timeoutMs = 60_000 } = {}) {
  const args = ['-p', '/context', '--resume', sessionId, '--fork-session', '--no-session-persistence', '--output-format', 'json']
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: cwd ?? undefined, stdio: ['ignore', 'pipe', 'pipe'], signal, timeout: timeoutMs, windowsHide: true })
    let out = ''
    let err = ''
    child.stdout.on('data', d => (out += d))
    child.stderr.on('data', d => (err += d))
    child.on('error', reject)
    child.on('close', code => {
      try {
        const result = JSON.parse(out).find(m => m.type === 'result')
        if (result?.num_turns !== 0) throw new Error('réponse inattendue : /context a été envoyé au modèle')
        const reading = parseContext(result.result ?? '')
        if (!reading) throw new Error('sortie de /context illisible')
        resolve(reading)
      } catch (e) {
        reject(new Error(`claude a échoué (code ${code}) : ${e.message}${err ? ` — ${err.trim().slice(0, 300)}` : ''}`))
      }
    })
  })
}
