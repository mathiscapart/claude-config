import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { inspect, latestTranscript, projectSlug, recentSessions } from '../worker/session.mjs'

const line = o => JSON.stringify(o) + '\n'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ctxbar-'))
  const a = join(root, 'C--repo-a')
  const b = join(root, 'C--repo-b')
  mkdirSync(join(a, 'aaa', 'subagents'), { recursive: true })
  mkdirSync(b)
  const write = (file, lines, t) => {
    writeFileSync(file, lines.map(line).join(''))
    utimesSync(file, t, t)
  }
  write(join(a, 'aaa.jsonl'), [
    { type: 'user', cwd: 'C:\\repo-a' },
    { type: 'assistant', uuid: 'u1', message: { stop_reason: 'end_turn' } },
    { type: 'ai-title', aiTitle: 'Titre A' },
  ], 1000)
  write(join(a, 'aaa', 'subagents', 'agent-1.jsonl'), [{ type: 'user' }], 5000) // ignoré
  write(join(b, 'bbb.jsonl'), [{ type: 'user', cwd: 'C:\\repo-b' }], 2000)
  return { root, a, b }
}

test('projectSlug reproduit le nom de dossier de Claude Code', () => {
  assert.equal(projectSlug('C:\\Users\\mathi\\Documents\\claude-config'), 'C--Users-mathi-Documents-claude-config')
  assert.equal(projectSlug('C:/Users/mathi/Documents/Agent IA'), 'C--Users-mathi-Documents-Agent-IA')
})

test('latestTranscript : le plus récent, globalement ou dans un projet, sans les sous-agents', () => {
  const { root, a } = fixture()
  assert.match(latestTranscript(root), /bbb\.jsonl$/)
  assert.match(latestTranscript(root, a), /aaa\.jsonl$/)
  assert.equal(latestTranscript(root, join(root, 'absent')), null)
})

test('inspect lit le titre, le cwd et la dernière fin de tour', () => {
  const { a } = fixture()
  assert.deepEqual(inspect(join(a, 'aaa.jsonl')), { sessionId: 'aaa', cwd: 'C:\\repo-a', turnId: 'u1', title: 'Titre A' })
})

test('recentSessions : du plus récent au plus ancien, avec titre et projet', () => {
  const { root } = fixture()
  assert.deepEqual(recentSessions(root).map(s => [s.sessionId, s.title, s.project]), [
    ['bbb', null, 'repo-b'],
    ['aaa', 'Titre A', 'repo-a'],
  ])
})
