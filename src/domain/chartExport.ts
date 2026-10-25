import type { Candidate, ElectionSnapshot, HistoryPoint } from './election.ts'
import { formatDate, formatNumber, formatPercent, formatShortTime, formatTime } from '../utils/format.ts'

export const CHART_IMAGE_WIDTH = 1600
export const CHART_IMAGE_HEIGHT = 1110

const colors = { flavio: '#8db9ff', lula: '#f5a28e' }

function escapeXml(value: string | number) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function text(x: number, y: number, value: string, size = 18, color = '#edf0ed', anchor = 'start', weight = 400) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${weight}">${escapeXml(value)}</text>`
}

function panel(x: number, y: number, width: number, height: number) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="#181e21" stroke="#2b3437"/>`
}

function candidateCard(candidate: Candidate, x: number) {
  const color = colors[candidate.key]
  return [
    panel(x, 150, 712, 214),
    text(x + 28, 194, candidate.name, 25, '#edf0ed', 'start', 600),
    text(x + 684, 192, `${candidate.number} · ${candidate.party}`, 17, color, 'end'),
    text(x + 28, 278, `${formatPercent(candidate.percent)}%`, 72, color, 'start', 500),
    text(x + 28, 321, `${formatNumber(candidate.votes)} votos`, 22),
    text(x + 684, 321, 'dos votos válidos', 16, '#97a3a8', 'end'),
    `<rect x="${x + 28}" y="341" width="656" height="4" rx="2" fill="#2b3437"/>`,
    `<rect x="${x + 28}" y="341" width="${(656 * candidate.percent / 100).toFixed(2)}" height="4" rx="2" fill="${color}"/>`,
  ].join('\n')
}

export function buildChartSvg(snapshot: ElectionSnapshot, history: readonly HistoryPoint[]): string {
  const left = 146
  const top = 484
  const width = 1328
  const height = 242
  const first = history[0]
  const last = history.at(-1)
  const start = first ? first.timestamp - (history.length === 1 ? 60_000 : 0) : 0
  const end = last ? last.timestamp + (history.length === 1 ? 60_000 : 0) : 1
  const span = Math.max(end - start, 1)
  const xFor = (timestamp: number) => left + (timestamp - start) / span * width
  const yFor = (percent: number) => top + (100 - percent) / 100 * height
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_IMAGE_WIDTH}" height="${CHART_IMAGE_HEIGHT}" viewBox="0 0 ${CHART_IMAGE_WIDTH} ${CHART_IMAGE_HEIGHT}" font-family="Arial, Helvetica, sans-serif">`,
    '<title>Apuração presidencial de 2026: percentuais, votos e evolução</title>',
    `<desc>Fonte: TSE. Parcial de ${escapeXml(formatDate(snapshot.generatedAt))} às ${escapeXml(formatTime(snapshot.generatedAt))}, horário de Brasília. Histórico de ${history.length} parciais registradas no acompanhamento.</desc>`,
    `<rect width="${CHART_IMAGE_WIDTH}" height="${CHART_IMAGE_HEIGHT}" fill="#111518"/>`,
    text(72, 60, 'ELEIÇÕES 2026  /  BRASIL  /  2º TURNO', 15, '#b8dfb2'),
    text(72, 111, 'Apuração presidencial', 38, '#edf0ed', 'start', 600),
    text(1528, 60, 'PARCIAL GERADA PELO TSE', 13, '#97a3a8', 'end'),
    text(1528, 95, `${formatDate(snapshot.generatedAt)} · ${formatTime(snapshot.generatedAt)}`, 24, '#edf0ed', 'end'),
    text(1528, 121, `${snapshot.finished ? 'Resultado final' : 'Resultado parcial'} · Horário de Brasília`, 14, '#97a3a8', 'end'),
    candidateCard(snapshot.candidates[0], 72),
    candidateCard(snapshot.candidates[1], 816),
    panel(72, 394, 1456, 414),
    text(100, 438, 'Evolução dos percentuais', 23, '#edf0ed', 'start', 600),
    '<circle cx="1170" cy="431" r="5" fill="#8db9ff"/>',
    text(1183, 437, 'Flávio Bolsonaro', 16, '#b4bec2'),
    '<circle cx="1410" cy="431" r="5" fill="#f5a28e"/>',
    text(1423, 437, 'Lula', 16, '#b4bec2'),
  ]

  for (const percent of [0, 25, 50, 75, 100]) {
    const y = yFor(percent)
    parts.push(
      `<line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" stroke="${percent === 50 ? '#596366' : '#2b3437'}" stroke-dasharray="4 6"/>`,
      text(left - 18, y + 5, `${percent}%`, 15, '#879398', 'end'),
    )
  }

  if (history.length > 0) {
    for (const key of ['flavio', 'lula'] as const) {
      if (history.length > 1) {
        const points = history.map((point) => `${xFor(point.timestamp).toFixed(2)},${yFor(point[key]).toFixed(2)}`).join(' ')
        parts.push(`<polyline points="${points}" fill="none" stroke="${colors[key]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`)
      }
      if (history.length < 10) {
        for (const point of history) {
          parts.push(`<circle cx="${xFor(point.timestamp).toFixed(2)}" cy="${yFor(point[key]).toFixed(2)}" r="4.5" fill="${colors[key]}"/>`)
        }
      }
    }
    const ticks = history.length === 1 ? [first.timestamp]
      : [start, start + span / 3, start + span * 2 / 3, end]
    for (const timestamp of ticks) {
      parts.push(text(xFor(timestamp), 755, formatShortTime(timestamp), 15, '#879398', 'middle'))
    }
  } else {
    parts.push(text(800, 616, 'Aguardando a primeira parcial com votos.', 20, '#97a3a8', 'middle'))
  }

  const historyNote = history.length === 1 ? '1 parcial registrada. A evolução aparece com as próximas parciais.'
    : `${history.length} parciais registradas. Percentuais oficiais dos votos válidos.`
  parts.push(
    text(100, 788, historyNote, 14, '#97a3a8'),
    panel(72, 840, 464, 154),
    panel(568, 840, 464, 154),
    panel(1064, 840, 464, 154),
    text(100, 878, 'VOTOS CONTABILIZADOS', 13, '#97a3a8'),
    text(100, 927, formatNumber(snapshot.totalVotes), 36, '#edf0ed', 'start', 500),
    text(100, 969, `Brancos: ${formatNumber(snapshot.blankVotes)} · Nulos: ${formatNumber(snapshot.nullVotes)}`, 14, '#97a3a8'),
    text(596, 878, 'VOTOS VÁLIDOS', 13, '#97a3a8'),
    text(596, 927, formatNumber(snapshot.validVotes), 36, '#edf0ed', 'start', 500),
    text(596, 969, 'Base dos percentuais dos candidatos', 14, '#97a3a8'),
    text(1092, 878, 'SEÇÕES TOTALIZADAS', 13, '#97a3a8'),
    text(1092, 927, `${formatPercent(snapshot.sectionsPercent)}%`, 36, '#b8dfb2', 'start', 500),
    text(1092, 969, `${formatNumber(snapshot.countedSections)} de ${formatNumber(snapshot.totalSections)} seções`, 14, '#97a3a8'),
    text(72, 1041, 'Fonte: Tribunal Superior Eleitoral · resultados.tse.jus.br', 16, '#b4bec2'),
    text(72, 1073, 'Histórico de parciais registradas. O horário da parcial não é o horário da exportação.', 14, '#879398'),
    '</svg>',
  )
  return parts.join('\n')
}
