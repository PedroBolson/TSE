import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ElectionSnapshot, HistoryPoint } from './election.ts'
import { buildChartSvg } from './chartExport.ts'

const snapshot: ElectionSnapshot = {
  id: '3948414', generatedAt: Date.parse('2026-10-25T20:06:31Z'),
  candidates: [
    { key: 'flavio', number: '22', name: 'Flávio Bolsonaro', party: 'PL', votes: 142169, percent: 42.34 },
    { key: 'lula', number: '13', name: 'Lula', party: 'PT', votes: 193574, percent: 57.66 },
  ],
  sectionsPercent: 0.25, countedSections: 1225, totalSections: 499248,
  totalVotes: 345054, validVotes: 335743, blankVotes: 4158, nullVotes: 5153, finished: false,
}
const point: HistoryPoint = {
  id: snapshot.id, timestamp: snapshot.generatedAt, flavio: 42.34, lula: 57.66, sectionsPercent: 0.25,
}

test('a imagem inclui percentuais, votos de cada candidato, total e horário de Brasília', () => {
  const svg = buildChartSvg(snapshot, [point])
  for (const label of ['Flávio Bolsonaro', 'Lula', '42,34%', '57,66%', '142.169 votos', '193.574 votos', '345.054', '335.743', '25/10/2026', '17:06:31', '0,25%']) {
    assert.ok(svg.includes(label), `Valor ausente na imagem: ${label}`)
  }
  assert.ok(svg.includes('Resultado parcial'))
})

test('preserva todos os pontos observados e não cria linha com uma única parcial', () => {
  assert.ok(!buildChartSvg(snapshot, [point]).includes('<polyline'))
  const svg = buildChartSvg(snapshot, [point, { ...point, id: 'next', timestamp: point.timestamp + 60_000, flavio: 43, lula: 57 }])
  const lines = [...svg.matchAll(/<polyline points="([^"]+)"/g)]
  assert.equal(lines.length, 2)
  assert.equal(lines[0][1].split(' ').length, 2)
  assert.equal(lines[1][1].split(' ').length, 2)
  assert.ok(svg.includes('2 parciais registradas'))
})

test('histórico vazio não gera evolução fictícia e exportar não modifica os dados', () => {
  const history = Object.freeze([Object.freeze({ ...point })])
  const before = JSON.stringify(history)
  buildChartSvg(snapshot, history)
  assert.equal(JSON.stringify(history), before)
  assert.ok(buildChartSvg(snapshot, []).includes('Aguardando a primeira parcial'))
  assert.ok(!buildChartSvg(snapshot, []).includes('<polyline'))
})

test('a imagem é autossuficiente e escapa texto antes de formar o SVG', () => {
  const changed = structuredClone(snapshot)
  changed.candidates[0].name = 'Nome <teste> & outro'
  const svg = buildChartSvg(changed, [point])
  assert.ok(svg.includes('Nome &lt;teste&gt; &amp; outro'))
  assert.ok(!svg.includes('<foreignObject'))
  assert.ok(!svg.includes('href='))
})
