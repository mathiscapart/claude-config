// Partagé par les deux panneaux (Context Bar, Conversations).
// Palette reprise du mod context-bar (plugins/context-bar/hooks/register.tsx, MIT).
export const PALETTE = ['#7aa2f7', '#7dcfff', '#bb9af7', '#9ece6a', '#e0af68', '#f7768e', '#73daca', '#ff9e64', '#c0caf5']
export const MESSAGES = '#d97757'
export const GREY = '#808080'

export const tokens = n => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(n))

export function el(tag, attrs = {}, text) {
  const e = document.createElement(tag)
  Object.assign(e, attrs)
  if (text !== undefined) e.textContent = text
  return e
}

// Évolution du total, une mesure par tour, de 0 au maximum atteint (le seuil d'auto-compaction
// écraserait la courbe sur une fenêtre de 1M). Une chute de plus de 30 % compte comme une compaction.
/** Dessine l'historique `h` dans `box` (un .history : svg > polyline, puis .caption). */
export function drawHistory(box, h) {
  box.hidden = h.length === 0
  if (!h.length) return
  const max = Math.max(...h.map(e => e.total))
  const y = t => (2 + 21 * (1 - t / max)).toFixed(2)
  const x = i => (h.length === 1 ? 100 : (100 * i) / (h.length - 1)).toFixed(2)
  box.querySelector('polyline').setAttribute('points', h.map((e, i) => `${x(i)},${y(e.total)}`).join(' ') + (h.length === 1 ? ` 0,${y(h[0].total)}` : ''))
  const compactions = h.filter((e, i) => i && e.total < 0.7 * h[i - 1].total).length
  const delta = h.length > 1 ? h.at(-1).total - h.at(-2).total : null
  box.querySelector('.caption').textContent = [
    `${h.length} mesure${h.length > 1 ? 's' : ''}`,
    delta !== null && `${delta >= 0 ? '+' : '−'}${tokens(Math.abs(delta))} depuis la précédente`,
    compactions && `${compactions} compaction${compactions > 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ')
  box.title = h.slice(-8).map(e => `${new Date(e.at).toLocaleString()} : ${tokens(e.total)}`).join('\n')
}

/** Un bloc .history vide, prêt pour drawHistory. */
export function historyBox() {
  const box = el('div', { className: 'history' })
  box.innerHTML = '<svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline /></svg><span class="caption muted"></span>'
  return box
}
