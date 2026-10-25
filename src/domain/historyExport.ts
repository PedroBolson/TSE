import type { HistoryPoint } from './election.ts'
import { formatDate, formatPercent, formatTime } from '../utils/format.ts'

function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value)
  const literal = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text
  return `"${literal.replaceAll('"', '""')}"`
}

export function historyToCsv(history: readonly HistoryPoint[]): string {
  const rows: (string | number | undefined)[][] = [
    [
      'id_parcial_tse', 'data_brasilia', 'hora_brasilia',
      'flavio_votos', 'flavio_percentual', 'lula_votos', 'lula_percentual',
      'secoes_totalizadas_percentual',
    ],
    ...history.map((point) => [
      point.id,
      formatDate(point.timestamp),
      formatTime(point.timestamp),
      point.flavioVotes,
      formatPercent(point.flavio),
      point.lulaVotes,
      formatPercent(point.lula),
      formatPercent(point.sectionsPercent),
    ]),
  ]
  // BOM, separador e decimais compatíveis com planilhas em português.
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n'
}
