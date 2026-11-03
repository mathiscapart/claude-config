// Toutes les conversations récentes avec leur dernière mesure enregistrée. Une ligne se déplie sur
// la répartition par catégorie et l'historique ; « Mesurer » lance /context sur cette session,
// « Suivre » l'épingle dans le panneau Context Bar.
import { GREY, MESSAGES, PALETTE, drawHistory, el, historyBox, tokens } from './common.js'

const $ = id => document.getElementById(id)
const request = (name, params = {}) => window.orca.plugin.request(name, params)
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

function ago(ms) {
  const s = (ms - Date.now()) / 1000
  for (const [unit, n] of [['day', 86400], ['hour', 3600], ['minute', 60]]) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), unit)
  return 'à l’instant'
}

const isUsed = name => !/deferred|^free space$|autocompact buffer/i.test(name)
const compactsAt = e => e.window - (e.categories['Autocompact buffer'] ?? 0)
const level = e => (e.total / compactsAt(e) >= 0.9 ? 'high' : e.total / compactsAt(e) >= 0.7 ? 'warn' : 'ok')

let data = { tracked: null, sessions: [] }
const open = new Set() // lignes dépliées, gardées d'un rechargement à l'autre
const busy = new Set() // mesures en cours

function breakdown(e) {
  const used = Object.entries(e.categories).filter(([n, t]) => isUsed(n) && t > 0)
  let i = 0
  const colored = used.map(([name, t]) => ({ name, t, color: name === 'Messages' ? MESSAGES : PALETTE[i++ % PALETTE.length] }))
  const bar = el('div', { className: 'bar' })
  bar.append(...colored.map(c => el('span', { title: `${c.name} : ${tokens(c.t)}`, style: `width:${(100 * c.t) / e.window}%;background:${c.color}` })))
  const buffer = e.categories['Autocompact buffer']
  if (buffer) bar.append(el('span', { className: 'buffer', style: `width:${(100 * buffer) / e.window}%;margin-left:auto`, title: `Autocompact buffer : ${tokens(buffer)}` }))
  const ul = el('ul', { className: 'items' })
  ul.append(...colored.sort((a, b) => b.t - a.t).map(c => {
    const li = el('li', { className: 'row item' })
    const sw = el('span', { className: 'swatch' })
    sw.style.background = c.color
    li.append(sw, el('span', { className: 'name' }, c.name), el('span', { className: 'tok' }, tokens(c.t)))
    return li
  }))
  return [bar, ul]
}

async function detail(s, body) {
  const actions = el('div', { className: 'actions' })
  const measureBtn = el('button', { type: 'button', disabled: busy.has(s.sessionId) }, busy.has(s.sessionId) ? 'Mesure…' : 'Mesurer')
  measureBtn.onclick = () => void measureOne(s.sessionId)
  const follow = el('button', { type: 'button', title: 'Épingler dans le panneau Context Bar et y aller' }, 'Suivre')
  follow.onclick = async () => {
    await request('session.pin', { sessionId: s.sessionId })
    $('status').textContent = `Context Bar suit « ${s.title ?? s.sessionId.slice(0, 8)} ».`
    await request('panel.open', { panel: 'context' }).catch(e => ($('status').textContent += ` (${e.message})`))
  }
  actions.append(measureBtn, follow)
  if (!s.last) return body.replaceChildren(el('p', { className: 'muted' }, 'Jamais mesurée.'), actions)
  const box = historyBox()
  body.replaceChildren(...breakdown(s.last), box, el('p', { className: 'muted meta' }, `${s.last.model ?? ''} · mesurée ${ago(s.last.at)}`), actions)
  drawHistory(box, await request('conversation.history', { sessionId: s.sessionId }))
}

function row(s) {
  const li = el('li', { className: `conv${s.sessionId === data.tracked ? ' tracked' : ''}` })
  const d = el('details', { open: open.has(s.sessionId) })
  const sum = el('summary')
  const top = el('div', { className: 'row' })
  top.append(el('span', { className: 'name title', title: s.title ?? s.sessionId }, s.title ?? s.sessionId.slice(0, 8)))
  top.append(s.last ? el('span', { className: `pct ${level(s.last)}` }, ` ${s.last.percent}% `) : el('span', { className: 'muted' }, '—'))
  const meta = el('div', { className: 'row muted meta' })
  meta.append(el('span', { className: 'name' }, [s.project, ago(s.mtime), s.sessionId === data.tracked && 'suivie'].filter(Boolean).join(' · ')))
  if (s.last) meta.append(el('span', { className: 'tok' }, tokens(s.last.total)))
  const gauge = el('div', { className: 'gauge' })
  if (s.last) gauge.append(el('span', { className: level(s.last), style: `width:${Math.min(100, (100 * s.last.total) / compactsAt(s.last))}%` }))
  sum.append(top, meta, gauge)
  const body = el('div', { className: 'body' })
  d.append(sum, body)
  d.ontoggle = () => {
    if (d.open) {
      open.add(s.sessionId)
      void detail(s, body)
    } else open.delete(s.sessionId)
  }
  if (d.open) void detail(s, body)
  li.append(d)
  return li
}

function render() {
  $('list').replaceChildren(...data.sessions.map(row))
  const measured = data.sessions.filter(s => s.last).length
  $('count').textContent = `${measured}/${data.sessions.length} mesurées`
}

async function load() {
  try {
    data = await request('conversations.list')
    render()
    $('status').className = 'muted'
    if ($('status').textContent === 'Chargement…') $('status').textContent = ''
  } catch (e) {
    $('status').className = 'error'
    $('status').textContent = e.message
  }
}

async function measureOne(sessionId) {
  busy.add(sessionId)
  render()
  try {
    await request('conversation.measure', { sessionId })
    $('status').textContent = ''
  } catch (e) {
    $('status').className = 'error'
    $('status').textContent = e.message
  } finally {
    busy.delete(sessionId)
    await load()
  }
}

$('reload').onclick = () => void load()
// Une mesure de la session suivie (panneau Context Bar) met la liste à jour.
window.orca.plugin.on('context.changed', state => state.status === 'ready' && void load())
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void load())
void load()
