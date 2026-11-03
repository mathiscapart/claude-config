// Lit la sortie Markdown de `claude -p /context` : en-tête « Tokens: X / Y (Z%) », le tableau
// « Estimated usage by category », puis un tableau par catégorie détaillée (MCP Tools, Custom
// Agents, Memory Files, Skills) rattaché à la catégorie du même nom.

const UNITS = { k: 1e3, m: 1e6 }

/** « 607 », « 2.5k », « 1m », « ~190 » → nombre de tokens. */
export function parseTokens(s) {
  const m = /^~?([\d.]+)\s*([km])?$/i.exec(s.trim())
  if (!m) return NaN
  return Math.round(parseFloat(m[1]) * (m[2] ? UNITS[m[2].toLowerCase()] : 1))
}

function kindOf(name) {
  if (/deferred/i.test(name)) return 'deferred' // listé par /context mais hors du total
  if (/^free space$/i.test(name)) return 'free'
  if (/autocompact buffer/i.test(name)) return 'buffer'
  return 'used'
}

const cellsOf = line => line.split('|').map(c => c.trim()).filter(Boolean)
const isRow = cells => cells.length > 0 && !/^-+$/.test(cells[0])

/** Tableaux « ### Titre » qui suivent les catégories → { titre en minuscules: éléments }. */
function details(sections) {
  const out = {}
  for (const section of sections) {
    const [title, ...lines] = section.split('\n')
    const rows = lines.filter(l => l.startsWith('|')).map(cellsOf).filter(isRow)
    const [cols, ...body] = rows
    if (!cols || cols.length < 2) continue
    const nameAt = cols.indexOf('Path') >= 0 ? cols.indexOf('Path') : 0 // Memory Files : Type | Path | Tokens
    const sourceAt = cols.findIndex((_, i) => i !== nameAt && i !== cols.length - 1)
    out[title.trim().toLowerCase()] = body
      .map(c => ({ name: c[nameAt], source: c[sourceAt] ?? null, tokens: parseTokens(c.at(-1)) }))
      .filter(i => Number.isFinite(i.tokens))
  }
  return out
}

/** @returns {{ model: string|null, total: number, window: number, percent: number, categories: { name: string, tokens: number, kind: string, items?: { name: string, source: string|null, tokens: number }[] }[] } | null} */
export function parseContext(md) {
  const head = /\*\*Tokens:\*\*\s*([\d.]+[km]?)\s*\/\s*([\d.]+[km]?)\s*\((\d+)%\)/i.exec(md)
  const [section, ...rest] = md.split(/^### Estimated usage by category/im)[1]?.split(/^### /m) ?? []
  if (!head || !section) return null
  const items = details(rest)
  const categories = []
  for (const line of section.split('\n')) {
    const cells = cellsOf(line)
    if (cells.length !== 3 || cells[0] === 'Category' || !isRow(cells)) continue
    const tokens = parseTokens(cells[1])
    if (!Number.isFinite(tokens)) continue
    const detail = items[cells[0].toLowerCase()]
    categories.push({ name: cells[0], tokens, kind: kindOf(cells[0]), ...(detail && { items: detail }) })
  }
  if (categories.length === 0) return null
  return {
    model: /\*\*Model:\*\*\s*(\S+)/.exec(md)?.[1] ?? null,
    total: parseTokens(head[1]),
    window: parseTokens(head[2]),
    percent: Number(head[3]),
    categories,
  }
}
