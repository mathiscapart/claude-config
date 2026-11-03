// Dessine la lecture que le worker envoie : barre empilée par catégorie, puis légende.
// Palette reprise du mod context-bar (plugins/context-bar/hooks/register.tsx, MIT).
const PALETTE = ['#7aa2f7', '#7dcfff', '#bb9af7', '#9ece6a', '#e0af68', '#f7768e', '#73daca', '#ff9e64', '#c0caf5']
const MESSAGES = '#d97757'
const GREY = '#808080'

const $ = id => document.getElementById(id)
const tokens = n => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(n))
const share = (n, w) => `${((100 * n) / w).toFixed(1)}%`

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag)
  Object.assign(e, attrs)
  if (text !== undefined) e.textContent = text
  return e
}

function colorOf(c, i) {
  if (c.kind === 'free' || c.kind === 'deferred') return 'transparent'
  if (c.kind === 'buffer') return GREY
  return c.name === 'Messages' ? MESSAGES : PALETTE[i % PALETTE.length]
}

function render(state) {
  const r = state.reading
  const compactsAt = r && r.window - (r.categories.find(c => c.kind === 'buffer')?.tokens ?? 0)
  $('status').className = state.status === 'error' ? 'error' : 'muted'
  $('status').textContent =
    state.status === 'loading' ? 'Mesure…' :
    state.status === 'error' ? state.error :
    r ? `${tokens(r.total)} sur ${tokens(r.window)} · compacte à ${tokens(compactsAt)}${r.model ? ` · ${r.model}` : ''}` : ''
  $('refresh').disabled = state.status === 'loading'
  if (!r) return

  const level = r.total / compactsAt
  $('pct').textContent = ` ${r.percent}% `
  $('pct').className = `pct ${level >= 0.9 ? 'high' : level >= 0.7 ? 'warn' : 'ok'}`

  let used = 0
  const rows = r.categories.map(c => ({ ...c, color: colorOf(c, c.kind === 'used' ? used++ : 0) }))

  const bar = $('bar')
  bar.replaceChildren(...rows.filter(c => c.kind !== 'deferred' && c.tokens > 0).map(c =>
    el('span', { className: c.kind, title: `${c.name} : ${tokens(c.tokens)}`, style: `width:${(100 * c.tokens) / r.window}%;background:${c.kind === 'buffer' ? '' : c.color}` })))
  bar.setAttribute('aria-label', `${r.percent}% du contexte utilisé`)

  $('legend').replaceChildren(...rows.map(c => {
    const li = el('li', { className: c.kind === 'used' ? '' : 'dim', title: c.kind === 'deferred' ? 'Chargé à la demande, hors du total' : '' })
    const sw = el('span', { className: 'swatch' })
    sw.style.background = c.kind === 'free' || c.kind === 'deferred' ? 'transparent' : c.color
    if (c.kind === 'free' || c.kind === 'deferred') sw.style.border = `1px solid ${GREY}`
    li.append(sw, el('span', { className: 'name' }, c.name), el('span', { className: 'tok' }, tokens(c.tokens)), el('span', { className: 'share muted' }, share(c.tokens, r.window)))
    return li
  }))
}

window.orca.plugin.on('context.changed', render)
$('refresh').onclick = async () => render(await window.orca.plugin.request('context.refresh', {}))
window.orca.plugin.request('context.get', {}).then(render, e => render({ status: 'error', error: e.message }))
