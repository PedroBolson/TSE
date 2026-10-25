import { REQUEST_TIMEOUT_MS, TSE_RESULTS_URL } from '../config.ts'
import { parseTseResults } from '../domain/election.ts'

export async function fetchElectionResults(signal: AbortSignal) {
  const response = await fetch(TSE_RESULTS_URL, {
    cache: 'no-cache',
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  })
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error('O TSE limitou temporariamente as consultas. Vamos tentar novamente em instantes.')
    }
    throw new Error(`O TSE não respondeu à consulta (HTTP ${response.status}).`)
  }
  return parseTseResults(await response.json())
}
