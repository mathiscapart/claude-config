import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { parseContext, parseTokens } from '../worker/parse.mjs'

const sample = readFileSync(new URL('./context-output.md', import.meta.url), 'utf8')

test('parseTokens lit les unités de /context', () => {
  assert.equal(parseTokens('607'), 607)
  assert.equal(parseTokens('2.5k'), 2500)
  assert.equal(parseTokens('1m'), 1_000_000)
  assert.equal(parseTokens('1.2M'), 1_200_000)
})

test('parseContext lit le total, la fenêtre et chaque catégorie', () => {
  const r = parseContext(sample)
  assert.equal(r.model, 'claude-opus-5-5')
  assert.equal(r.total, 51_100)
  assert.equal(r.window, 1_000_000)
  assert.equal(r.percent, 5)
  assert.equal(r.categories.length, 12)
  assert.deepEqual(r.categories[0], { name: 'System prompt', tokens: 2500, kind: 'used' })
  assert.deepEqual(r.categories.find(c => c.name === 'MCP tools (deferred)').kind, 'deferred')
  assert.equal(r.categories.find(c => c.name === 'Free space').kind, 'free')
  assert.equal(r.categories.find(c => c.name === 'Autocompact buffer').kind, 'buffer')
})

test('les catégories utilisées font le total annoncé', () => {
  const r = parseContext(sample)
  const used = r.categories.filter(c => c.kind === 'used').reduce((s, c) => s + c.tokens, 0)
  assert.ok(Math.abs(used - r.total) <= 200, `${used} vs ${r.total}`)
})

test('parseContext renvoie null sur une sortie inattendue', () => {
  assert.equal(parseContext('Unknown command: /context'), null)
})
