import { CircleCheck } from 'lucide-react'
import type { ElectionSnapshot } from '../domain/election.ts'
import { formatNumber, formatPercent } from '../utils/format.ts'

export function CountingProgress({ snapshot }: { snapshot: ElectionSnapshot }) {
  const radius = 55
  const circumference = 2 * Math.PI * radius
  return (
    <section className="panel progress-panel" aria-labelledby="progress-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">ANDAMENTO NO BRASIL</span>
          <h2 id="progress-title">Seções totalizadas</h2>
        </div>
        {snapshot.finished && <CircleCheck size={20} className="green-text" aria-label="Totalização concluída" />}
      </div>
      <div className="progress-content">
        <div className="progress-ring" role="img" aria-label={`${formatPercent(snapshot.sectionsPercent)}% das seções totalizadas`}>
          <svg viewBox="0 0 136 136" aria-hidden="true">
            <circle cx="68" cy="68" r={radius} fill="none" stroke="#293235" strokeWidth="7" />
            <circle cx="68" cy="68" r={radius} fill="none" stroke="#b8dfb2" strokeWidth="7"
              strokeLinecap={snapshot.sectionsPercent > 0 ? 'round' : 'butt'}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - snapshot.sectionsPercent / 100)}
              transform="rotate(-90 68 68)" />
          </svg>
          <div className="progress-ring-label">
            <strong className="tabular">{formatPercent(snapshot.sectionsPercent)}<small>%</small></strong>
            <span>totalizadas</span>
          </div>
        </div>
        <p className="section-count"><strong className="tabular">{formatNumber(snapshot.countedSections)}</strong> de {formatNumber(snapshot.totalSections)} seções</p>
      </div>
      <dl className="vote-breakdown">
        <div><dt>Votos contabilizados</dt><dd>{formatNumber(snapshot.totalVotes)}</dd></div>
        <div><dt>Válidos</dt><dd>{formatNumber(snapshot.validVotes)}</dd></div>
        <div><dt>Brancos</dt><dd>{formatNumber(snapshot.blankVotes)}</dd></div>
        <div><dt>Nulos</dt><dd>{formatNumber(snapshot.nullVotes)}</dd></div>
      </dl>
    </section>
  )
}
