import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { lastReadings, readHistory, record } from '../worker/history.mjs'

const reading = (total, extra = {}) => ({
  model: 'claude-opus-5-5',
  total,
  window: 1_000_000,
  percent: Math.round(total / 1e4),
  categories: [
    { name: 'Messages', tokens: total - 1000, kind: 'used' },
    { name: 'MCP tools', tokens: 1000, kind: 'used', items: [{ name: 'x', source: 's', tokens: 1000 }] },
    { name: 'Free space', tokens: 1_000_000 - total, kind: 'free' },
  ],
  ...extra,
})

test('record ajoute une ligne par mesure, sans le détail par élément', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ctxbar-'))
  record('s1', 't1', reading(20_000), { dir, at: 1 })
  record('s1', 't2', reading(25_000), { dir, at: 2 })
  const h = readHistory('s1', dir)
  assert.equal(h.length, 2)
  assert.deepEqual(h[1], { at: 2, turnId: 't2', model: 'claude-opus-5-5', total: 25_000, window: 1_000_000, percent: 3, categories: { Messages: 24_000, 'MCP tools': 1000, 'Free space': 975_000 } })
  assert.ok(!readFileSync(join(dir, 's1.jsonl'), 'utf8').includes('items'))
})

test('remesurer le même tour avec le même total ne duplique pas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ctxbar-'))
  record('s1', 't1', reading(20_000), { dir, at: 1 })
  record('s1', 't1', reading(20_000), { dir, at: 2 })
  assert.equal(readHistory('s1', dir).length, 1)
  record('s1', 't1', reading(21_000), { dir, at: 3 }) // config changée (MCP, CLAUDE.md) : nouvelle ligne
  assert.equal(readHistory('s1', dir).length, 2)
})

test('record renvoie l’historique à jour', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ctxbar-'))
  assert.equal(record('s1', 't1', reading(20_000), { dir, at: 1 }).length, 1)
  assert.equal(record('s1', 't2', reading(30_000), { dir, at: 2 }).at(-1).total, 30_000)
})

test('readHistory : session jamais mesurée → vide ; ligne abîmée ignorée', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ctxbar-'))
  assert.deepEqual(readHistory('inconnue', dir), [])
  record('s1', 't1', reading(20_000), { dir, at: 1 })
  appendFileSync(join(dir, 's1.jsonl'), '{"at": 2, coupé\n')
  record('s1', 't2', reading(22_000), { dir, at: 3 })
  assert.deepEqual(readHistory('s1', dir).map(e => e.at), [1, 3])
})

test('lastReadings donne la dernière mesure de chaque session', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ctxbar-'))
  record('a', 't1', reading(10_000), { dir, at: 1 })
  record('a', 't2', reading(12_000), { dir, at: 2 })
  record('b', 't1', reading(50_000), { dir, at: 3 })
  const last = lastReadings(['a', 'b', 'c'], dir)
  assert.equal(last.a.total, 12_000)
  assert.equal(last.a.count, 2)
  assert.equal(last.b.total, 50_000)
  assert.equal(last.c, undefined)
})
