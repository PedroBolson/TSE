import type { HistoryPoint } from './election.ts'

const axisNumber = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
export const formatAxisPercent = (value: number) => `${axisNumber.format(value)}%`

export function getChartScale(history: readonly HistoryPoint[]): { domain: [number, number], ticks: number[] } {
  if (history.length === 0) return { domain: [0, 100], ticks: [0, 25, 50, 75, 100] }

  const values = history.flatMap(({ flavio, lula }) => [flavio, lula])
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  // Preserve the entire history, with breathing room and at least two percentage points.
  const span = Math.min(100, Math.max((maximum - minimum) * 1.3, 2))
  const midpoint = (minimum + maximum) / 2
  const start = Math.max(0, Math.min(midpoint - span / 2, 100 - span))
  const step = [0.5, 1, 2, 5, 10, 20, 25].find((value) => value >= span / 4) ?? 25
  const lower = Math.max(0, Math.floor(start / step) * step)
  const upper = Math.min(100, Math.ceil((start + span) / step) * step)
  const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, index) => lower + index * step)
  return { domain: [lower, upper], ticks }
}
