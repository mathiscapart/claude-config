import { test } from 'node:test'
import assert from 'node:assert/strict'

import { activePath } from '../worker/workspace.mjs'

const ps = (...rows) => ({ worktrees: rows.map(([path, isActive]) => ({ path, isActive, displayName: 'main', branch: 'refs/heads/main' })) })

test('le workspace ouvert, même parmi des homonymes', () => {
  assert.equal(activePath(ps(['C:/piloti', false], ['C:/claude-config', true], ['C:/Agent IA', false])), 'C:/claude-config')
})

test('aucun workspace ouvert : null', () => {
  assert.equal(activePath(ps(['C:/piloti', false])), null)
  assert.equal(activePath({ worktrees: [] }), null)
})
