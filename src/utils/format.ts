const integer = new Intl.NumberFormat('pt-BR')
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const clock = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit',
})
const shortClock = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
})
const calendar = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })

export const formatNumber = (value: number) => integer.format(value)
export const formatPercent = (value: number) => decimal.format(value)
export const formatTime = (timestamp: number) => clock.format(timestamp)
export const formatShortTime = (timestamp: number) => shortClock.format(timestamp)
export const formatDate = (timestamp: number) => calendar.format(timestamp)

export function elapsedLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000))
  if (seconds < 60) return 'menos de 1 min'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}
