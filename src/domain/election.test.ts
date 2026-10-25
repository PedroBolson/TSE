import assert from 'node:assert/strict'
import { test } from 'node:test'
import { appendHistory, mergeCloudHistory, newerSnapshot, parseTseResults, restoreHistory } from './election.ts'

function fixture() {
  return {
    ele: '6258', t: '2', f: 'o', cdabr: 'br', idg: '3948414',
    dg: '25/10/2026', hg: '17:06:31', and: 'p',
    carg: [{ cd: '1', agr: [
      { par: [{ cand: [{ n: '22', vap: '142169', pvap: '42,34' }] }] },
      { par: [{ cand: [{ n: '13', vap: '193574', pvap: '57,66' }] }] },
    ] }],
    s: { pst: '0,25', st: '1225', ts: '499248' },
    v: { tv: '345054', vv: '335743', vb: '4158', tvn: '5153' },
  }
}

test('lê candidatos aninhados em grupos diferentes e mantém a ordem por número', () => {
  const source = fixture()
  source.carg[0].agr.reverse()
  const result = parseTseResults(source)
  assert.deepEqual(result.candidates.map(({ key, votes, percent }) => ({ key, votes, percent })), [
    { key: 'flavio', votes: 142169, percent: 42.34 },
    { key: 'lula', votes: 193574, percent: 57.66 },
  ])
  assert.equal(result.sectionsPercent, 0.25)
  assert.equal(result.nullVotes, 5153)
})

test('usa o percentual publicado pelo TSE, sem calcular sobre brancos e nulos', () => {
  const source = fixture()
  source.v.tv = '999999'
  const result = parseTseResults(source)
  assert.equal(result.candidates[0].percent, 42.34)
  assert.equal(result.candidates[1].percent, 57.66)
})

test('interpreta o horário da parcial em Brasília, independente do fuso do computador', () => {
  assert.equal(parseTseResults(fixture()).generatedAt, Date.parse('2026-10-25T20:06:31Z'))
})

test('recusa outra eleição, simulação e candidato ausente', () => {
  assert.throws(() => parseTseResults({ ...fixture(), ele: '6257' }), /não corresponde/)
  assert.throws(() => parseTseResults({ ...fixture(), f: 's' }), /não corresponde/)
  const missing = fixture()
  missing.carg[0].agr.pop()
  assert.throws(() => parseTseResults(missing), /Lula/)
})

test('recusa percentuais fora do intervalo e números vazios em vez de exibir zero', () => {
  const source = fixture()
  source.carg[0].agr[0].par[0].cand[0].pvap = '101,00'
  assert.throws(() => parseTseResults(source), /fora do intervalo/)
  source.carg[0].agr[0].par[0].cand[0].pvap = ''
  assert.throws(() => parseTseResults(source), /inválido/)
})

test('recusa datas impossíveis', () => {
  assert.throws(() => parseTseResults({ ...fixture(), dg: '31/02/2026' }), /Data da parcial inválida/)
  assert.throws(() => parseTseResults({ ...fixture(), hg: '25:06:31' }), /Data da parcial inválida/)
})

test('não regride para uma parcial antiga recebida do cache', () => {
  const latest = parseTseResults(fixture())
  const old = parseTseResults({ ...fixture(), hg: '17:00:00', idg: 'old' })
  assert.equal(newerSnapshot(latest, old), latest)
  assert.equal(newerSnapshot(null, latest), latest)
})

test('não duplica a mesma parcial nem insere pontos fora de ordem', () => {
  const snapshot = parseTseResults(fixture())
  const history = appendHistory([], snapshot)
  assert.equal(appendHistory(history, snapshot), history)
  assert.equal(appendHistory(history, { ...snapshot, id: 'older', generatedAt: snapshot.generatedAt - 1_000 }), history)
  assert.equal(appendHistory(history, { ...snapshot, id: 'next', generatedAt: snapshot.generatedAt + 60_000 }).length, 2)
  assert.equal(appendHistory(history, { ...snapshot, id: 'regenerated' }).length, 1)
})

test('uma parcial inicial sem votos não cria evolução fictícia', () => {
  const snapshot = { ...parseTseResults(fixture()), countedSections: 0 }
  assert.deepEqual(appendHistory([], snapshot), [])
})

test('completa votos de uma parcial antiga sem apagar registros nem duplicar pontos', () => {
  const snapshot = parseTseResults(fixture())
  const legacy = {
    id: snapshot.id, timestamp: snapshot.generatedAt,
    flavio: 42.34, lula: 57.66, sectionsPercent: 0.25,
  }
  const restored = restoreHistory(JSON.stringify([legacy]))
  assert.equal(restored.length, 1)
  assert.equal(restored[0].flavioVotes, undefined)
  const completed = appendHistory(restored, snapshot)
  assert.equal(completed.length, 1)
  assert.equal(completed[0].flavioVotes, 142169)
  assert.equal(completed[0].lulaVotes, 193574)
})

test('só encerra a consulta automática quando o TSE informa totalização final', () => {
  const source = fixture()
  source.s.pst = '100,00'
  assert.equal(parseTseResults(source).finished, false)
  source.and = 'f'
  assert.equal(parseTseResults(source).finished, true)
})

test('restaura histórico válido sem travar com armazenamento corrompido', () => {
  const history = appendHistory([], parseTseResults(fixture()))
  assert.deepEqual(restoreHistory(JSON.stringify(history)), history)
  assert.deepEqual(restoreHistory('não é json'), [])
  assert.deepEqual(restoreHistory(JSON.stringify([null, {}, { ...history[0], lula: 101 }])), [])
})

test('combina parciais da nuvem com o histórico local, preenchendo lacunas sem perder pontos', () => {
  const first = parseTseResults(fixture())
  const third = { ...first, id: 'third', generatedAt: first.generatedAt + 120_000 }
  const local = appendHistory(appendHistory([], first), third)
  const second = { ...first, id: 'second', generatedAt: first.generatedAt + 60_000 }
  const merged = mergeCloudHistory(local, [first, second, third])
  assert.deepEqual(merged.map((point) => point.id), [first.id, 'second', 'third'])
  assert.equal(merged[1].flavioVotes, 142169)
  assert.equal(local.length, 2)
  assert.equal(mergeCloudHistory(merged, [first, second, third]).length, 3)
})


test('a leitura estadual exige a UF certa e mantém o isolamento do Brasil', () => {
  const rs = { ...fixture(), cdabr: 'rs' }
  assert.equal(parseTseResults(rs, 'rs').scope, 'rs')
  assert.throws(() => parseTseResults(rs), /não corresponde/)
  assert.throws(() => parseTseResults(rs, 'sp'), /não corresponde/)
  assert.throws(() => parseTseResults(fixture(), 'rs'), /não corresponde/)
  assert.equal(parseTseResults({ ...fixture(), cdabr: 'zz' }, 'zz').scope, 'zz')
})
