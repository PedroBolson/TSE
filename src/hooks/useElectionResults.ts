import { useCallback, useEffect, useRef, useState } from 'react'
import { HISTORY_STORAGE_KEY, MAX_RETRY_INTERVAL_MS, REFRESH_INTERVAL_MS } from '../config.ts'
import { appendHistory, newerSnapshot, restoreHistory } from '../domain/election.ts'
import type { ElectionSnapshot } from '../domain/election.ts'
import { fetchElectionResults } from '../services/tse.ts'

function savedHistory() {
  try {
    return restoreHistory(localStorage.getItem(HISTORY_STORAGE_KEY))
  } catch {
    return []
  }
}

export function useElectionResults() {
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null)
  const [history, setHistory] = useState(savedHistory)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null)
  const [nextFetchAt, setNextFetchAt] = useState<number | null>(null)
  const fetchRef = useRef<() => void>(() => {})
  const snapshotRef = useRef<ElectionSnapshot | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
    } catch {
      // A consulta continua funcionando mesmo se o navegador bloquear o armazenamento.
    }
  }, [history])

  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | null = null
    let consecutiveFailures = 0

    async function run() {
      if (disposed || controller) return
      clearTimeout(timer)
      controller = new AbortController()
      setIsFetching(true)
      setNextFetchAt(null)
      let delay = REFRESH_INTERVAL_MS

      try {
        const incoming = await fetchElectionResults(controller.signal)
        if (disposed) return
        const accepted = newerSnapshot(snapshotRef.current, incoming)
        snapshotRef.current = accepted
        setSnapshot(accepted)
        setHistory((previous) => appendHistory(previous, accepted))
        setLastSuccessAt(Date.now())
        setError(null)
        consecutiveFailures = 0
      } catch (failure) {
        if (disposed) return
        consecutiveFailures += 1
        delay = Math.min(
          REFRESH_INTERVAL_MS * 2 ** Math.min(consecutiveFailures - 1, 3),
          MAX_RETRY_INTERVAL_MS,
        )
        const message = failure instanceof Error && failure.name !== 'TypeError'
          ? failure.name === 'TimeoutError'
            ? 'O TSE demorou para responder. Tentaremos de novo automaticamente.'
            : failure.message
          : 'Não foi possível consultar o TSE. Confira a conexão; tentaremos de novo automaticamente.'
        setError(message)
      } finally {
        controller = null
        if (!disposed) {
          setIsFetching(false)
          if (!snapshotRef.current?.finished) {
            setNextFetchAt(Date.now() + delay)
            timer = setTimeout(() => void run(), delay)
          }
        }
      }
    }

    fetchRef.current = () => void run()
    void run()
    return () => {
      disposed = true
      clearTimeout(timer)
      controller?.abort()
      fetchRef.current = () => {}
    }
  }, [])

  const refresh = useCallback(() => fetchRef.current(), [])
  return { snapshot, history, isFetching, error, lastSuccessAt, nextFetchAt, refresh }
}
