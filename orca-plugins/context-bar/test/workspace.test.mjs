import { test } from 'node:test'
import assert from 'node:assert/strict'

import { pickPath } from '../worker/workspace.mjs'

const w = (displayName, branch, path, isActive = false) => ({ displayName, branch, path, isActive })
const ps = {
  worktrees: [
    w('develop', 'refs/heads/develop-2', 'C:/piloti/develop-2'),
    w('main', 'refs/heads/main', 'C:/piloti'),
    w('main', 'refs/heads/main', 'C:/claude-config', true),
    w('BitWarden', '', 'C:/BitWarden'),
  ],
}
const ctx = (displayName, branch) => ({ displayName, branch, terminals: [] })

test("nom et branche uniques : l'événement suffit, même si isActive est en retard", () => {
  assert.deepEqual(pickPath(ctx('develop', 'develop-2'), ps), { path: 'C:/piloti/develop-2', ambiguous: false })
})

test('dossier sans branche', () => {
  assert.equal(pickPath(ctx('BitWarden', ''), ps).path, 'C:/BitWarden')
})

test('homonymes : isActive tranche', () => {
  assert.deepEqual(pickPath(ctx('main', 'refs/heads/main'), ps), { path: 'C:/claude-config', ambiguous: false })
})

test('homonymes sans isActive parmi eux : ambigu, pas de choix au hasard', () => {
  const lagging = { worktrees: ps.worktrees.map(x => ({ ...x, isActive: x.displayName === 'develop' })) }
  assert.deepEqual(pickPath(ctx('main', 'main'), lagging), { path: null, ambiguous: true })
})

test('workspace inconnu : null', () => {
  assert.deepEqual(pickPath(ctx('autre', 'main'), ps), { path: null, ambiguous: false })
})
