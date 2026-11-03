// Historique des mesures : un fichier JSONL par session, une ligne par mesure (sans le détail par
// élément, pour garder des lignes courtes).
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const historyDir = () => join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'context-bar', 'history')

/** Toutes les mesures d'une session, de la plus ancienne à la plus récente. */
export function readHistory(sessionId, dir = historyDir()) {
  const file = join(dir, `${sessionId}.jsonl`)
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8').split('\n').flatMap(l => {
    try { return l.trim() ? [JSON.parse(l)] : [] } catch { return [] }
  })
}

/** Ajoute une mesure, sauf si elle répète la dernière (même tour, même total). Renvoie l'historique. */
export function record(sessionId, turnId, { model, total, window, percent, categories }, { dir = historyDir(), at = Date.now() } = {}) {
  const history = readHistory(sessionId, dir)
  const prev = history.at(-1)
  if (prev && prev.turnId === turnId && prev.total === total) return history
  const entry = { at, turnId, model, total, window, percent, categories: Object.fromEntries(categories.map(c => [c.name, c.tokens])) }
  mkdirSync(dir, { recursive: true })
  appendFileSync(join(dir, `${sessionId}.jsonl`), `${JSON.stringify(entry)}\n`)
  return [...history, entry]
}

/** Dernière mesure (et nombre de mesures) de chaque session qui en a une. */
export function lastReadings(sessionIds, dir = historyDir()) {
  const out = {}
  for (const id of sessionIds) {
    const h = readHistory(id, dir)
    if (h.length) out[id] = { ...h.at(-1), count: h.length }
  }
  return out
}
