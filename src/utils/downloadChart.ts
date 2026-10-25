import type { ElectionSnapshot, HistoryPoint } from '../domain/election.ts'
import { buildChartSvg, CHART_IMAGE_HEIGHT, CHART_IMAGE_WIDTH } from '../domain/chartExport.ts'
import { formatDate, formatTime } from './format.ts'

export async function downloadChart(snapshot: ElectionSnapshot, history: readonly HistoryPoint[]) {
  const svg = new Blob([buildChartSvg(snapshot, history)], { type: 'image/svg+xml;charset=utf-8' })
  const source = URL.createObjectURL(svg)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Não foi possível gerar a imagem do gráfico.'))
      image.src = source
    })
    const canvas = document.createElement('canvas')
    canvas.width = CHART_IMAGE_WIDTH
    canvas.height = CHART_IMAGE_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('O navegador não conseguiu criar a imagem.')
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar o PNG.')), 'image/png')
    })
    const url = URL.createObjectURL(png)
    const date = formatDate(snapshot.generatedAt).split('/').reverse().join('-')
    const time = formatTime(snapshot.generatedAt).replaceAll(':', '-')
    const link = document.createElement('a')
    link.href = url
    link.download = `apuracao-presidente_${date}_${time}.png`
    link.hidden = true
    document.body.append(link)
    try {
      link.click()
    } finally {
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1_000)
    }
  } finally {
    URL.revokeObjectURL(source)
  }
}
