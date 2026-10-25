import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HistoryPoint } from './election.ts'
import { historyToCsv } from './historyExport.ts'

const point: HistoryPoint = {
  id: '3948414', timestamp: Date.parse('2026-10-25T20:06:31Z'),
  flavio: 42.34, lula: 57.66, flavioVotes: 142169, lulaVotes: 193574,
  sectionsPercent: 0.25,
}

test('exporta todas as linhas com BOM, horário de Brasília e decimais em português', () => {
  const csv = historyToCsv([point, { ...point, id: 'next', timestamp: point.timestamp + 60_000 }])
  const lines = csv.slice(1).trimEnd().split('\r\n')
  assert.ok(csv.startsWith('\uFEFF'))
  assert.equal(lines.length, 3)
  assert.equal(lines[1], '"3948414";"25/10/2026";"17:06:31";"142169";"42,34";"193574";"57,66";"0,25"')
  assert.match(lines[2], /"17:07:31"/)
})

test('preserva parciais antigas sem inventar votos ausentes', () => {
  const { flavioVotes: _flavioVotes, lulaVotes: _lulaVotes, ...legacy } = point
  const csv = historyToCsv([legacy])
  assert.ok(csv.includes(';"";"42,34";"";"57,66";'))
})

test('exportação não altera nem esvazia o histórico', () => {
  const history = Object.freeze([Object.freeze({ ...point })])
  const before = JSON.stringify(history)
  historyToCsv(history)
  assert.equal(JSON.stringify(history), before)
})

test('escapa aspas e separadores e mantém identificadores como texto literal', () => {
  const csv = historyToCsv([{ ...point, id: '=1;"texto"' }])
  assert.ok(csv.includes('"\'=1;""texto""";'))
})
