import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HistoryPoint } from '../domain/election.ts'
import { formatAxisPercent, getChartScale } from '../domain/chartScale.ts'
import { formatPercent, formatShortTime, formatTime } from '../utils/format.ts'

export function HistoryChart({ history }: { history: HistoryPoint[] }) {
  const scale = getChartScale(history)
  const scaleLabel = `Escala automática: ${formatAxisPercent(scale.domain[0])} a ${formatAxisPercent(scale.domain[1])}.`
  const first = history[0]
  const last = history.at(-1)
  const domain: [number, number] | undefined = first && last
    ? [first.timestamp - (history.length === 1 ? 60_000 : 0), last.timestamp + (history.length === 1 ? 60_000 : 0)]
    : undefined

  return (
    <section className="panel history-panel" aria-labelledby="history-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PARCIAL A PARCIAL</span>
          <h2 id="history-title">Evolução dos percentuais</h2>
        </div>
        <span className="subtle-badge">{history.length} {history.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-dot flavio-dot" />Flávio Bolsonaro</span>
        <span><i className="legend-dot lula-dot" />Lula</span>
      </div>
      <div className="chart-frame" role="img" aria-label={`Gráfico do histórico de percentuais oficiais da coleta na nuvem e deste navegador. Azul para Flávio Bolsonaro e coral para Lula. ${scaleLabel}`}>
        {history.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={history} margin={{ top: 14, right: 15, left: -6, bottom: 8 }} accessibilityLayer>
              <CartesianGrid stroke="#2b3437" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="timestamp" type="number" domain={domain} scale="time"
                tickFormatter={formatShortTime} stroke="#6d7b80" tickLine={false}
                axisLine={false} tickCount={4} minTickGap={44} tickMargin={12}
                tick={{ fontSize: 14, fill: '#879398' }}
              />
              <YAxis
                width={68} domain={scale.domain} ticks={scale.ticks}
                tickFormatter={formatAxisPercent} tickLine={false}
                axisLine={false} tickMargin={10} tick={{ fontSize: 14, fill: '#879398' }}
              />
              {scale.domain[0] <= 50 && scale.domain[1] >= 50 && (
                <ReferenceLine y={50} stroke="#596366" strokeDasharray="4 5" />
              )}
              <Tooltip
                labelFormatter={(label) => `Parcial das ${formatTime(Number(label))}`}
                formatter={(value, name) => [`${formatPercent(Number(value))}%`, name]}
                contentStyle={{ background: '#20282c', border: '1px solid #384347', borderRadius: 12, fontSize: 15 }}
                labelStyle={{ color: '#c5ced1', marginBottom: 7 }}
                cursor={{ stroke: '#69767b', strokeDasharray: '3 3' }}
              />
              <Line type="linear" dataKey="flavio" name="Flávio Bolsonaro" stroke="#8db9ff" strokeWidth={2.5}
                dot={history.length < 10 ? { r: 3, strokeWidth: 0 } : false}
                activeDot={{ r: 5, strokeWidth: 3, stroke: '#181e21' }} isAnimationActive={false} />
              <Line type="linear" dataKey="lula" name="Lula" stroke="#f5a28e" strokeWidth={2.5}
                dot={history.length < 10 ? { r: 3, strokeWidth: 0 } : false}
                activeDot={{ r: 5, strokeWidth: 3, stroke: '#181e21' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="chart-empty">O gráfico começa com a primeira parcial com votos.</div>}
      </div>
      <p className="panel-note">
        {history.length > 0 && <span className="chart-scale-note">{scaleLabel}</span>}
        {history.length === 1
          ? 'Primeira parcial registrada. A linha aparece quando chegar uma nova parcial.'
          : 'Histórico da coleta na nuvem e das parciais salvas neste navegador.'}
      </p>
    </section>
  )
}
