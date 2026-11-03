import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickPath } from '../worker/workspace.mjs'

const worktrees = [
  { displayName: 'main', branch: 'refs/heads/main', path: 'C:/piloti' },
  { displayName: 'main', branch: 'refs/heads/main', path: 'C:/claude-config' },
  { displayName: 'orca-context-bar', branch: 'refs/heads/feat/orca-context-bar', path: 'C:/wt/orca-context-bar' },
]
const noTerminals = () => assert.fail('terminal list ne devrait pas être lu')
const ctx = (displayName, branch, terminals = []) => ({ displayName, branch, terminals })

test('un seul candidat : son chemin, sans lire les terminaux', async () => {
  assert.equal(await pickPath(ctx('orca-context-bar', 'feat/orca-context-bar'), worktrees, noTerminals, () => 0), 'C:/wt/orca-context-bar')
})

test('aucun candidat : null', async () => {
  assert.equal(await pickPath(ctx('autre', 'main'), worktrees, noTerminals, () => 0), null)
})

test('homonymes : un terminal du workspace tranche', async () => {
  const terminals = async () => [{ handle: 'term_1', ptyId: 'x', worktreePath: 'C:/piloti' }]
  assert.equal(await pickPath(ctx('main', 'refs/heads/main', [{ id: 'term_1' }]), worktrees, terminals, () => 0), 'C:/piloti')
})

test('homonymes sans terminal : la session Claude la plus récente', async () => {
  const activity = p => (p === 'C:/claude-config' ? 2000 : 1000)
  assert.equal(await pickPath(ctx('main', 'main'), worktrees, noTerminals, activity), 'C:/claude-config')
})
