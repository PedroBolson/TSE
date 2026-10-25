import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ElectionSnapshot } from './election.ts'
import { REGIONS, resultsUrl, sumRegions } from './regions.ts'
import { statePaths } from '../data/statePaths.ts'

function snapshot(flavio: number, lula: number, sections = 10, totalSections = 100): ElectionSnapshot {
  return {
    id: String(flavio), generatedAt: 1_000, candidates: [
      { key: 'flavio', name: 'Flávio Bolsonaro', number: '22', party: 'PL', votes: flavio, percent: flavio / (flavio + lula) * 100 },
      { key: 'lula', name: 'Lula', number: '13', party: 'PT', votes: lula, percent: lula / (flavio + lula) * 100 },
    ], sectionsPercent: sections / totalSections * 100, countedSections: sections, totalSections,
    totalVotes: flavio + lula + 10, validVotes: flavio + lula, blankVotes: 5, nullVotes: 5, finished: false,
  }
}

test('soma os votos dos estados e calcula percentuais ponderados, incluindo exterior', () => {
  const total = sumRegions([
    { code: 'rs', snapshot: snapshot(90, 10), error: null },
    { code: 'sp', snapshot: snapshot(100, 900, 80), error: null },
    { code: 'zz', snapshot: snapshot(10, 90, 10, 10), error: null },
  ])
  assert.equal(total.flavio, 200)
  assert.equal(total.lula, 1000)
  assert.equal(total.validVotes, 1200)
  assert.equal(total.flavioPercent, 200 / 1200 * 100)
  assert.equal(total.lulaPercent, 1000 / 1200 * 100)
  assert.equal(total.sectionsPercent, 100 / 210 * 100)
  assert.equal(total.hasExterior, true)
  assert.equal(total.available, 3)
})

test('não trata UFs ausentes como resultados zero nem apresenta NaN sem dados', () => {
  const total = sumRegions([{ code: 'rs', snapshot: null, error: 'Sem conexão' }])
  assert.equal(total.available, 0)
  assert.equal(total.flavioPercent, 0)
  assert.equal(total.sectionsPercent, 0)
  assert.equal(total.oldestAt, null)
  assert.equal(total.hasExterior, false)
})

test('preserva a faixa de horários das parciais estaduais na soma', () => {
  const a = snapshot(10, 90)
  const b = { ...snapshot(90, 10), generatedAt: 5_000 }
  const results = [{ code: 'rs' as const, snapshot: a, error: null }, { code: 'sp' as const, snapshot: b, error: null }]
  const before = JSON.stringify(results)
  assert.equal(sumRegions(results).oldestAt, 1_000)
  assert.equal(sumRegions(results).newestAt, 5_000)
  assert.equal(JSON.stringify(results), before)
})

test('mapa cobre as 27 UFs uma única vez e não inventa uma área para o exterior', () => {
  const codes = statePaths.map(({ code }) => code).sort()
  assert.deepEqual(codes, REGIONS.filter(({ code }) => code !== 'zz').map(({ code }) => code).sort())
  assert.equal(new Set(codes).size, 27)
  assert.ok(statePaths.every(({ path, x, y }) => path.startsWith('M') && !path.includes('NaN') && x >= 0 && x <= 620 && y >= 0 && y <= 610))
  assert.match(resultsUrl('rs'), /\/rs\/rs-c0001-e006258-u.json$/)
  assert.match(resultsUrl('zz'), /\/zz\/zz-c0001-e006258-u.json$/)
})
