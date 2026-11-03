// Dessine la lecture que le worker envoie : barre empilée par catégorie, puis légende.
import { GREY, MESSAGES, PALETTE, drawHistory, el, tokens } from './common.js'

const $ = id => document.getElementById(id)
const share = (n, w) => `${((100 * n) / w).toFixed(1)}%`

function colorOf(c, i) {
  if (c.kind === 'free' || c.kind === 'deferred') return 'transparent'
  if (c.kind === 'buffer') return GREY
  return c.name === 'Messages' ? MESSAGES : PALETTE[i % PALETTE.length]
}

let current = {}
let sessions = []
const label = s => `${s.title ?? s.sessionId.slice(0, 8)} — ${s.project}`

function renderSessions() {
  const auto = el('option', { value: '' }, `Auto · ${current.title ?? current.sessionId?.slice(0, 8) ?? '…'}${current.workspace ? ` (${current.workspace})` : ''}`)
  const list = current.pinned && !sessions.some(s => s.sessionId === current.pinned)
    ? [{ sessionId: current.pinned, title: current.title, project: '…' }, ...sessions] // épinglée mais sortie des récentes
    : sessions
  $('session').replaceChildren(auto, ...list.map(s => el('option', { value: s.sessionId }, label(s))))
  $('session').value = current.pinned ?? ''
}

async function loadSessions() {
  sessions = await window.orca.plugin.request('sessions.list', {})
  renderSessions()
}

// Dernier état complet (avec une lecture). Le worker peut redémarrer (Orca l'arrête quand il est
// inactif) et renvoyer un état vide : on garde alors l'affichage précédent jusqu'à la nouvelle mesure.
// Gardé aussi dans localStorage pour qu'un rechargement du panneau ne parte pas de rien.
let last = JSON.parse(localStorage.getItem('last') ?? 'null')

function render(state) {
  if (state.reading) {
    last = state
    localStorage.setItem('last', JSON.stringify(state))
  }
  const known = Object.fromEntries(Object.entries(state).filter(([, v]) => v != null))
  current = { ...last, ...known, pinned: state.pinned ?? null, error: state.error ?? null }
  renderSessions()
  const r = current.reading
  const compactsAt = r && r.window - (r.categories.find(c => c.kind === 'buffer')?.tokens ?? 0)
  $('status').className = state.status === 'error' ? 'error' : 'muted'
  $('status').textContent =
    state.status === 'error' ? state.error :
    r ? `${tokens(r.total)} sur ${tokens(r.window)} · compacte à ${tokens(compactsAt)}${r.model ? ` · ${r.model}` : ''}${state.status === 'busy' ? ' · mesure précédente' : ''}` :
    state.status === 'busy' ? 'Mesure indisponible, nouvel essai au prochain tour.' :
    state.status === 'loading' ? 'Mesure…' : '' // seulement tant qu'il n'y a encore rien à montrer
  // /context renvoie parfois une sortie vide : on garde la dernière lecture plutôt qu'une erreur.
  $('status').title = state.status === 'busy' ? '/context n’a rien renvoyé pour ce tour. ↻ pour réessayer.' : ''
  $('refresh').disabled = state.status === 'loading'
  $('refresh').classList.toggle('loading', state.status === 'loading')
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
  drawHistory($('history'), current.history ?? [])

  $('legend').replaceChildren(...rows.map(c => {
    const li = el('li', { className: c.kind === 'used' ? '' : 'dim', title: c.kind === 'deferred' ? 'Chargé à la demande, hors du total' : '' })
    const sw = el('span', { className: 'swatch' })
    sw.style.background = c.kind === 'free' || c.kind === 'deferred' ? 'transparent' : c.color
    if (c.kind === 'free' || c.kind === 'deferred') sw.style.border = `1px solid ${GREY}`
    const row = [sw, el('span', { className: 'name' }, c.name), el('span', { className: 'tok' }, tokens(c.tokens)), el('span', { className: 'share muted' }, share(c.tokens, r.window))]
    if (c.items?.length) li.append(foldable(c.name, row, detailOf(c)))
    else li.append(...row)
    return li
  }))
}

// Détail d'une catégorie (tableaux par élément de /context). Les sections ouvertes le restent
// d'une mesure à l'autre.
const open = new Set()

function foldable(key, summaryChildren, body) {
  const d = el('details', { open: open.has(key) })
  d.ontoggle = () => (d.open ? open.add(key) : open.delete(key))
  const s = el('summary', { className: 'row' })
  s.append(...summaryChildren)
  d.append(s, body)
  return d
}

const byTokens = (a, b) => b.tokens - a.tokens

function itemRow({ name, source, tokens: n }, label = name) {
  const li = el('li', { className: 'row item', title: source ? `${name} (${source})` : name })
  li.append(el('span', { className: 'name' }, label), el('span', { className: 'tok' }, tokens(n)))
  return li
}

function detailOf(c) {
  const ul = el('ul', { className: 'items' })
  if (c.name !== 'MCP tools') {
    ul.append(...[...c.items].sort(byTokens).map(i => itemRow(i, c.name === 'Memory files' ? `${i.name.split(/[\\/]/).pop()} · ${i.source}` : i.name)))
    return ul
  }
  // Outils MCP : un groupe par serveur. /context les liste tous, différés compris.
  const servers = [...Map.groupBy(c.items, i => i.source ?? '?')]
    .map(([server, tools]) => ({ server, tools, sum: tools.reduce((s, t) => s + t.tokens, 0) }))
    .sort((a, b) => b.sum - a.sum)
  ul.append(el('li', { className: 'muted note' }, 'Liste complète, outils différés compris'))
  for (const { server, tools, sum } of servers) {
    const sub = el('ul', { className: 'items' })
    sub.append(...tools.sort(byTokens).map(t => itemRow(t, t.name.replace(`mcp__${server}__`, ''))))
    const li = el('li')
    li.append(foldable(`mcp:${server}`, [el('span', { className: 'name' }, `${server} (${tools.length})`), el('span', { className: 'tok' }, tokens(sum))], sub))
    ul.append(li)
  }
  return ul
}

window.orca.plugin.on('context.changed', render)
$('session').onfocus = () => void loadSessions() // liste à jour à chaque ouverture
$('session').onchange = async e => render(await window.orca.plugin.request('session.pin', { sessionId: e.target.value || null }))
void loadSessions()
$('refresh').onclick = async () => render(await window.orca.plugin.request('context.refresh', {}))
if (last) render({ ...last, status: 'loading' }) // tout de suite, avant la réponse du worker
window.orca.plugin.request('context.get', {}).then(render, e => render({ status: 'error', error: e.message }))

// Orca arrête le worker après quelques minutes sans requête, et ne le relance pas pour
// workspace.changed : le panneau, actif tant qu'il est ouvert, relaie l'événement (ce qui
// relance le worker) et le sollicite toutes les minutes pour qu'il garde sa surveillance.
window.orca.on('workspace.changed', ({ context }) => void window.orca.plugin.request('workspace.focus', { context }).catch(() => {}))
setInterval(() => void window.orca.plugin.request('context.get', {}).then(render, () => {}), 60_000)
