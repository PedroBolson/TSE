import type { ElectionSnapshot } from './election.ts'

export const REGIONS = [
  { code: 'ac', name: 'Acre', ibge: '12' },
  { code: 'al', name: 'Alagoas', ibge: '27' },
  { code: 'ap', name: 'Amapá', ibge: '16' },
  { code: 'am', name: 'Amazonas', ibge: '13' },
  { code: 'ba', name: 'Bahia', ibge: '29' },
  { code: 'ce', name: 'Ceará', ibge: '23' },
  { code: 'df', name: 'Distrito Federal', ibge: '53' },
  { code: 'es', name: 'Espírito Santo', ibge: '32' },
  { code: 'go', name: 'Goiás', ibge: '52' },
  { code: 'ma', name: 'Maranhão', ibge: '21' },
  { code: 'mt', name: 'Mato Grosso', ibge: '51' },
  { code: 'ms', name: 'Mato Grosso do Sul', ibge: '50' },
  { code: 'mg', name: 'Minas Gerais', ibge: '31' },
  { code: 'pa', name: 'Pará', ibge: '15' },
  { code: 'pb', name: 'Paraíba', ibge: '25' },
  { code: 'pr', name: 'Paraná', ibge: '41' },
  { code: 'pe', name: 'Pernambuco', ibge: '26' },
  { code: 'pi', name: 'Piauí', ibge: '22' },
  { code: 'rj', name: 'Rio de Janeiro', ibge: '33' },
  { code: 'rn', name: 'Rio Grande do Norte', ibge: '24' },
  { code: 'rs', name: 'Rio Grande do Sul', ibge: '43' },
  { code: 'ro', name: 'Rondônia', ibge: '11' },
  { code: 'rr', name: 'Roraima', ibge: '14' },
  { code: 'sc', name: 'Santa Catarina', ibge: '42' },
  { code: 'sp', name: 'São Paulo', ibge: '35' },
  { code: 'se', name: 'Sergipe', ibge: '28' },
  { code: 'to', name: 'Tocantins', ibge: '17' },
  { code: 'zz', name: 'Exterior', ibge: '' },
] as const

export type RegionCode = typeof REGIONS[number]['code']
export type ElectionScope = 'br' | RegionCode
export const isRegionCode = (value: string): value is RegionCode => REGIONS.some(({ code }) => code === value)
export const scopeName = (scope: string) => scope === 'br' ? 'Brasil' : REGIONS.find(({ code }) => code === scope)?.name ?? scope.toUpperCase()
export const resultsUrl = (scope: ElectionScope = 'br') =>
  `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${scope}/${scope}-c0001-e006258-u.json`

export interface RegionResult {
  code: RegionCode
  snapshot: ElectionSnapshot | null
  error: string | null
}

export function sumRegions(results: readonly RegionResult[]) {
  const available = results.filter((result) => result.snapshot !== null)
  const total = available.reduce((sum, { snapshot }) => ({
    flavio: sum.flavio + snapshot!.candidates[0].votes,
    lula: sum.lula + snapshot!.candidates[1].votes,
    validVotes: sum.validVotes + snapshot!.validVotes,
    totalVotes: sum.totalVotes + snapshot!.totalVotes,
    countedSections: sum.countedSections + snapshot!.countedSections,
    totalSections: sum.totalSections + snapshot!.totalSections,
  }), { flavio: 0, lula: 0, validVotes: 0, totalVotes: 0, countedSections: 0, totalSections: 0 })
  return {
    ...total,
    flavioPercent: total.validVotes ? total.flavio / total.validVotes * 100 : 0,
    lulaPercent: total.validVotes ? total.lula / total.validVotes * 100 : 0,
    sectionsPercent: total.totalSections ? total.countedSections / total.totalSections * 100 : 0,
    available: available.length,
    hasExterior: available.some(({ code }) => code === 'zz'),
    oldestAt: available.length ? Math.min(...available.map(({ snapshot }) => snapshot!.generatedAt)) : null,
    newestAt: available.length ? Math.max(...available.map(({ snapshot }) => snapshot!.generatedAt)) : null,
  }
}
