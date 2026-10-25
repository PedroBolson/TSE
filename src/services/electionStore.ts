import {
  collection, doc, getDocFromServer, getDocsFromServer, limit, onSnapshot, orderBy, query,
} from 'firebase/firestore'
import { parseTseResults } from '../domain/election.ts'
import type { ElectionSnapshot } from '../domain/election.ts'
import { firestore } from './firebase.ts'

export interface CollectorStatus {
  lastSuccessAt: number | null
  error: string | null
}

const stateRef = doc(firestore, 'elections', '6258')
const partials = collection(stateRef, 'partials')
const historyQuery = query(partials, orderBy('generatedAt', 'desc'), limit(720))

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
}) {
  const unsubscribeResults = onSnapshot(historyQuery, (result) => {
    try {
      callbacks.onResults(result.docs.map((partial) => parseTseResults(partial.data().raw)).reverse())
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error('Dados da nuvem inválidos.'))
    }
  }, callbacks.onError)
  const unsubscribeStatus = onSnapshot(stateRef, { includeMetadataChanges: true }, (result) => {
    callbacks.onStatus(statusFrom(result.data()), result.metadata.fromCache)
  }, callbacks.onError)
  return () => {
    unsubscribeResults()
    unsubscribeStatus()
  }
}

export async function readLatestFromServer() {
  const [latest, state] = await Promise.all([
    getDocsFromServer(query(partials, orderBy('generatedAt', 'desc'), limit(1))),
    getDocFromServer(stateRef),
  ])
  return {
    results: latest.docs.map((partial) => parseTseResults(partial.data().raw)),
    status: statusFrom(state.data()),
  }
}
