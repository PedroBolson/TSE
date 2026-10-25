import { collection, doc, getDocFromServer, getDocsFromServer, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { parseTseResults } from '../domain/election.ts'
import type { ElectionSnapshot } from '../domain/election.ts'
import { REGIONS, isRegionCode } from '../domain/regions.ts'
import type { ElectionScope, RegionResult } from '../domain/regions.ts'
import { firestore } from './firebase.ts'

export interface CollectorStatus { lastSuccessAt: number | null; error: string | null }
const nationalRef = doc(firestore, 'elections', '6258')

function electionRefs(scope: ElectionScope) {
  const stateRef = scope === 'br' ? nationalRef : doc(nationalRef, 'regions', scope)
  const partials = collection(stateRef, 'partials')
  return { stateRef, partials, historyQuery: query(partials, orderBy('generatedAt', 'desc'), limit(720)) }
}

function statusFrom(data: Record<string, unknown> | undefined): CollectorStatus {
  return {
    lastSuccessAt: typeof data?.lastSuccessAt === 'number' ? data.lastSuccessAt : null,
    error: typeof data?.error === 'string' ? data.error : null,
  }
}

export function subscribeToElection(callbacks: {
  onResults: (results: ElectionSnapshot[]) => void
  onStatus: (status: CollectorStatus, fromCache: boolean) => void
  onError: (error: Error) => void
}, scope: ElectionScope = 'br') {
  const { stateRef, historyQuery } = electionRefs(scope)
  const unsubscribeResults = onSnapshot(historyQuery, (result) => {
    try {
      callbacks.onResults(result.docs.map((partial) => parseTseResults(partial.data().raw, scope)).reverse())
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error('Dados da nuvem inválidos.'))
    }
  }, callbacks.onError)
  const unsubscribeStatus = onSnapshot(stateRef, { includeMetadataChanges: true }, (result) => {
    callbacks.onStatus(statusFrom(result.data()), result.metadata.fromCache)
  }, callbacks.onError)
  return () => { unsubscribeResults(); unsubscribeStatus() }
}

export async function readLatestFromServer(scope: ElectionScope = 'br') {
  const { stateRef, partials } = electionRefs(scope)
  const [latest, state] = await Promise.all([
    getDocsFromServer(query(partials, orderBy('generatedAt', 'desc'), limit(1))), getDocFromServer(stateRef),
  ])
  return {
    results: latest.docs.map((partial) => parseTseResults(partial.data().raw, scope)), status: statusFrom(state.data()),
  }
}

export function subscribeToRegions(onResults: (results: RegionResult[]) => void, onError: (error: Error) => void) {
  return onSnapshot(collection(nationalRef, 'regions'), (result) => {
    const byCode = new Map<string, RegionResult>()
    for (const item of result.docs) {
      if (!isRegionCode(item.id)) continue
      const data = item.data()
      const code = item.id
      let snapshot: ElectionSnapshot | null = null
      let error = typeof data.error === 'string' ? data.error : null
      try { if (data.raw) snapshot = parseTseResults(data.raw, code) }
      catch { error = 'A parcial recebida não corresponde a esta UF.' }
      byCode.set(code, { code, snapshot, error })
    }
    onResults(REGIONS.map(({ code }) => byCode.get(code) ?? { code, snapshot: null, error: null }))
  }, onError)
}
