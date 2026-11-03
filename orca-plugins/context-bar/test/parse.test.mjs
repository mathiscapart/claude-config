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
  assert.equal(parseTokens('~190'), 190)
})

test('parseContext lit le total, la fenêtre et chaque catégorie', () => {
  const r = parseContext(sample)
  assert.equal(r.model, 'claude-opus-5-5')
  assert.equal(r.total, 57_100)
  assert.equal(r.window, 1_000_000)
  assert.equal(r.percent, 6)
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

test('parseContext rattache le détail de chaque élément à sa catégorie', () => {
  const r = parseContext(sample)
  const of = name => r.categories.find(c => c.name === name)
  assert.deepEqual(of('MCP tools').items.at(-1), { name: 'mcp__context7__resolve-library-id', source: 'context7', tokens: 1100 })
  assert.equal(of('Custom agents').items.length, 13)
  assert.deepEqual(of('Custom agents').items[0], { name: 'architect', source: 'User', tokens: 117 })
  // Mémoire : le chemin identifie l'élément, le type (User, Project…) est la source.
  assert.deepEqual(of('Memory files').items[0], { name: String.raw`C:\Users\mathi\.claude\CLAUDE.md`, source: 'User', tokens: 2900 })
  // Skills : estimations « ~190 ».
  assert.deepEqual(of('Skills').items[0], { name: 'orca-cli', source: 'User', tokens: 190 })
  assert.equal(of('Messages').items, undefined)
})

test('parseContext renvoie null sur une sortie inattendue', () => {
  assert.equal(parseContext('Unknown command: /context'), null)
})
