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
    r ? `${tokens(r.total)} sur ${tokens(r.window)} · compacte à ${tokens(compactsAt)}${r.model ? ` · ${r.model}` : ''}` :
    state.status === 'loading' ? 'Mesure…' : '' // seulement tant qu'il n'y a encore rien à montrer
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
