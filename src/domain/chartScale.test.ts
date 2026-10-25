import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HistoryPoint } from './election.ts'
import { formatAxisPercent, getChartScale } from './chartScale.ts'

function point(flavio: number, lula = 100 - flavio): HistoryPoint {
  return { id: String(flavio), timestamp: 0, flavio, lula, sectionsPercent: 1 }
}

test('aproxima percentuais próximos sem criar uma escala nula num empate', () => {
  for (const history of [[point(49.9)], [point(50)]]) {
    const { domain, ticks } = getChartScale(history)
    assert.deepEqual(domain, [49, 51])
    assert.ok(ticks.includes(50))
    assert.ok(ticks.includes(49.5))
  }
  assert.equal(formatAxisPercent(49.5), '49,5%')
})

test('mantém os extremos antigos mesmo quando as últimas parciais se aproximam', () => {
  const history = [point(65), point(49.9), point(50)]
  const { domain, ticks } = getChartScale(history)
  assert.ok(domain[0] <= 35)
  assert.ok(domain[1] >= 65)
  assert.ok(domain[1] - domain[0] < 100)
  assert.equal(ticks[0], domain[0])
  assert.equal(ticks.at(-1), domain[1])
})

test('limita a escala a percentuais válidos, incluindo os casos nas bordas', () => {
  for (const history of [[point(0)], [point(100)], [point(0, 0)], [point(100, 100)]]) {
    const { domain, ticks } = getChartScale(history)
    assert.ok(domain[0] >= 0)
    assert.ok(domain[1] <= 100)
    assert.ok(domain[1] - domain[0] >= 2)
    for (const { flavio, lula } of history) {
      assert.ok(flavio >= domain[0] && flavio <= domain[1])
      assert.ok(lula >= domain[0] && lula <= domain[1])
    }
    assert.ok(ticks.length >= 2 && ticks.length <= 7)
  }
})

test('histórico vazio mantém a escala geral', () => {
  assert.deepEqual(getChartScale([]), { domain: [0, 100], ticks: [0, 25, 50, 75, 100] })
})
