import type { Candidate } from '../domain/election.ts'
import { formatNumber, formatPercent } from '../utils/format.ts'

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <article className={`candidate-card ${candidate.key}`} aria-label={`Resultado de ${candidate.name}`}>
      <div className="candidate-heading">
        <span className="candidate-marker" aria-hidden="true">{candidate.number}</span>
        <div>
          <h2>{candidate.name}</h2>
          <span className="muted">{candidate.party} · Presidente</span>
        </div>
        <span className="candidate-color-dot" aria-hidden="true" />
      </div>
      <div className="candidate-percentage tabular">
        {formatPercent(candidate.percent)}<span>%</span>
      </div>
      <div className="candidate-bottom">
        <span className="candidate-votes"><strong className="tabular">{formatNumber(candidate.votes)}</strong> votos</span>
        <span className="muted">dos votos válidos</span>
      </div>
      <div className="candidate-track" aria-hidden="true">
        <div style={{ width: `${candidate.percent}%` }} />
      </div>
    </article>
  )
}
