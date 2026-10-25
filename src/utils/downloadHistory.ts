import type { HistoryPoint } from '../domain/election.ts'
import { historyToCsv } from '../domain/historyExport.ts'
import { formatDate, formatTime } from './format.ts'

export function downloadHistory(history: readonly HistoryPoint[]) {
  if (history.length === 0) return
  const now = Date.now()
  const date = formatDate(now).split('/').reverse().join('-')
  const time = formatTime(now).replaceAll(':', '-')
  const blob = new Blob([historyToCsv(history)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `apuracao-presidente-2026_${date}_${time}.csv`
  link.hidden = true
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }
}
