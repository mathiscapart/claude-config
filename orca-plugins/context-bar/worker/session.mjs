// Trouve la session Claude Code active et la mesure avec `/context`, sans appel au modèle.
import { spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'

import { parseContext } from './parse.mjs'

export const projectsDir = () => join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects')

/** Nom du dossier où Claude Code range les sessions d'un répertoire de travail. */
export const projectSlug = path => path.replace(/[^a-zA-Z0-9]/g, '-')

/** Transcripts principaux (`<projet>/<session>.jsonl`, pas les sous-agents), du plus récent au plus ancien. */
function transcripts(root, only) {
  const dirs = only ? [only] : readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => join(root, d.name))
  const out = []
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.jsonl')) out.push({ file: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs })
    }
  }
  return out.sort((x, y) => y.mtime - x.mtime)
}

/** Le transcript écrit le plus récemment, partout ou dans le seul dossier `only`. */
export function latestTranscript(root = projectsDir(), only) {
  return transcripts(root, only)[0]?.file ?? null
}

/** Les `n` sessions les plus récentes, pour le sélecteur. */
export function recentSessions(root = projectsDir(), n = 15) {
  return transcripts(root).slice(0, n).map(({ file, mtime }) => {
    const s = inspect(file)
    return { sessionId: s.sessionId, title: s.title, project: s.cwd ? basename(s.cwd) : basename(dirname(file)), mtime }
  })
}

/** Le fichier d'une session donnée, s'il existe encore. */
export function transcriptOf(sessionId, root = projectsDir()) {
  return transcripts(root).find(t => basename(t.file, '.jsonl') === sessionId)?.file ?? null
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

/** { sessionId, cwd, turnId, title }: turnId = uuid de la dernière réponse finale, null si aucune. */
export function inspect(file) {
  const lines = tailLines(file)
  const cwd = lines.findLast(o => typeof o.cwd === 'string')?.cwd ?? null
  const turn = lines.findLast(o => o.type === 'assistant' && o.message?.stop_reason === 'end_turn')
  const title = lines.findLast(o => o.type === 'ai-title')?.aiTitle ?? null
  return { sessionId: basename(file, '.jsonl'), cwd, turnId: turn?.uuid ?? null, title }
}

/**
 * La sortie JSON de `claude -p /context` → la lecture, ou null quand `/context` n'a rien renvoyé
 * (observé par intermittence, cause non identifiée : on réessaiera au tour suivant).
 */
export function readResult(stdout) {
  const result = JSON.parse(stdout).find(m => m.type === 'result')
  if (result?.num_turns !== 0) throw new Error('réponse inattendue : /context a été envoyé au modèle')
  if (!result.result?.trim()) return null
  const reading = parseContext(result.result)
  if (!reading) throw new Error('sortie de /context illisible')
  return reading
}

/** Lance `claude -p /context` sur une copie éphémère de la session. Résout null si la sortie est vide. */
export function measure({ sessionId, cwd }, { signal, timeoutMs = 60_000, onEmpty } = {}) {
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
        const reading = readResult(out)
        if (!reading) onEmpty?.(`/context vide (code ${code})${err ? ` — ${err.trim().slice(0, 300)}` : ''}`)
        resolve(reading)
      } catch (e) {
        reject(new Error(`claude a échoué (code ${code}) : ${e.message}${err ? ` — ${err.trim().slice(0, 300)}` : ''}`))
      }
    })
  })
}
