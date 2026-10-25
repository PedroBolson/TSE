import { useCallback, useEffect, useRef, useState } from 'react'
import { HISTORY_STORAGE_KEY } from '../config.ts'
import { mergeCloudHistory, newerSnapshot, restoreHistory } from '../domain/election.ts'
import type { ElectionSnapshot } from '../domain/election.ts'
import type { ElectionScope } from '../domain/regions.ts'
import { readLatestFromServer, subscribeToElection } from '../services/electionStore.ts'
import type { CollectorStatus } from '../services/electionStore.ts'

const storageKey = (scope: ElectionScope) => scope === 'br' ? HISTORY_STORAGE_KEY : `apuracao-tse:6258:${scope}:history:v1`

function savedHistory(scope: ElectionScope) {
  try {
    return restoreHistory(localStorage.getItem(storageKey(scope)))
  } catch {
    return []
  }
}

export function useElectionResults(scope: ElectionScope = 'br') {
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null)
  const [history, setHistory] = useState(() => savedHistory(scope))
  const [isFetching, setIsFetching] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [collectorError, setCollectorError] = useState<string | null>(null)
  const [isFromCache, setIsFromCache] = useState(true)
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null)
  const snapshotRef = useRef<ElectionSnapshot | null>(null)
  const refreshRef = useRef<() => void>(() => {})

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(scope), JSON.stringify(history))
    } catch {
      // A assinatura da nuvem continua mesmo sem armazenamento no navegador.
    }
  }, [history, scope])

  useEffect(() => {
    let disposed = false
    let manualRefreshRunning = false

    function acceptResults(results: ElectionSnapshot[]) {
      if (disposed) return
      const latest = results.at(-1)
      if (latest) {
        const accepted = newerSnapshot(snapshotRef.current, latest)
        snapshotRef.current = accepted
        setSnapshot(accepted)
        setHistory((previous) => mergeCloudHistory(previous, results))
      }
      setIsFetching(false)
    }
    function acceptStatus(status: CollectorStatus, fromCache: boolean) {
      if (disposed) return
      setLastSuccessAt(status.lastSuccessAt)
      setCollectorError(status.error)
      setIsFromCache(fromCache)
      if (!fromCache) setConnectionError(null)
    }
    function reportError() {
      if (disposed) return
      setIsFetching(false)
      setConnectionError('Não foi possível sincronizar com o Firestore. Os dados já recebidos continuam visíveis.')
    }

    const unsubscribe = subscribeToElection({ onResults: acceptResults, onStatus: acceptStatus, onError: reportError }, scope)
    refreshRef.current = () => {
      if (disposed || manualRefreshRunning) return
      manualRefreshRunning = true
      setIsFetching(true)
      void readLatestFromServer(scope).then(({ results, status }) => {
        if (disposed) return
        acceptResults(results)
        acceptStatus(status, false)
      }).catch(reportError).finally(() => {
        manualRefreshRunning = false
        if (!disposed) setIsFetching(false)
      })
    }
    return () => {
      disposed = true
      unsubscribe()
      refreshRef.current = () => {}
    }
  }, [scope])

  const refresh = useCallback(() => refreshRef.current(), [])
  return { snapshot, history, isFetching, error: connectionError ?? collectorError, lastSuccessAt, isFromCache, refresh }
}
