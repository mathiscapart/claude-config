// Lit la sortie Markdown de `claude -p /context` : en-tête « Tokens: X / Y (Z%) »,
// puis le tableau « Estimated usage by category ».

const UNITS = { k: 1e3, m: 1e6 }

/** « 607 », « 2.5k », « 1m » → nombre de tokens. */
export function parseTokens(s) {
  const m = /^([\d.]+)\s*([km])?$/i.exec(s.trim())
  if (!m) return NaN
  return Math.round(parseFloat(m[1]) * (m[2] ? UNITS[m[2].toLowerCase()] : 1))
}

function kindOf(name) {
  if (/deferred/i.test(name)) return 'deferred' // listé par /context mais hors du total
  if (/^free space$/i.test(name)) return 'free'
  if (/autocompact buffer/i.test(name)) return 'buffer'
  return 'used'
}

/** @returns {{ model: string|null, total: number, window: number, percent: number, categories: { name: string, tokens: number, kind: string }[] } | null} */
export function parseContext(md) {
  const head = /\*\*Tokens:\*\*\s*([\d.]+[km]?)\s*\/\s*([\d.]+[km]?)\s*\((\d+)%\)/i.exec(md)
  const section = md.split(/### Estimated usage by category/i)[1]
  if (!head || !section) return null
  const categories = []
  for (const line of section.split('\n')) {
    if (line.startsWith('###')) break
    const cells = line.split('|').map(c => c.trim()).filter(Boolean)
    if (cells.length !== 3 || cells[0] === 'Category' || /^-+$/.test(cells[0])) continue
    const tokens = parseTokens(cells[1])
    if (Number.isFinite(tokens)) categories.push({ name: cells[0], tokens, kind: kindOf(cells[0]) })
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
