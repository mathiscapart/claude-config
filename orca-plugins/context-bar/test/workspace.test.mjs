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
const ctx = (displayName, branch, terminals = []) => ({ displayName, branch, terminals })
const noTerminals = async () => assert.fail('terminal list ne devrait pas être lu')

test("nom et branche uniques : l'événement suffit, même si isActive est en retard", async () => {
  assert.deepEqual(await pickPath(ctx('develop', 'develop-2'), ps, noTerminals), { path: 'C:/piloti/develop-2', ambiguous: false })
})

test('dossier sans branche', async () => {
  assert.equal((await pickPath(ctx('BitWarden', ''), ps, noTerminals)).path, 'C:/BitWarden')
})

test('homonymes : un terminal du workspace tranche, avant isActive', async () => {
  const terminals = async () => [{ handle: 'term_1', worktreePath: 'C:/piloti' }]
  assert.deepEqual(await pickPath(ctx('main', 'main', [{ id: 'term_1' }]), ps, terminals), { path: 'C:/piloti', ambiguous: false })
})

test('homonymes sans terminal : isActive tranche', async () => {
  assert.deepEqual(await pickPath(ctx('main', 'refs/heads/main'), ps, noTerminals), { path: 'C:/claude-config', ambiguous: false })
})

test('homonymes sans isActive parmi eux : ambigu, pas de choix au hasard', async () => {
  const lagging = { worktrees: ps.worktrees.map(x => ({ ...x, isActive: x.displayName === 'develop' })) }
  assert.deepEqual(await pickPath(ctx('main', 'main'), lagging, noTerminals), { path: null, ambiguous: true })
})

test('workspace inconnu : null', async () => {
  assert.deepEqual(await pickPath(ctx('autre', 'main'), ps, noTerminals), { path: null, ambiguous: false })
})
