import { useEffect, useState } from 'react'
import { CHART_START_AT } from '../config.ts'
import { ArrowUpRight, Download, MapPin } from 'lucide-react'
import type { ElectionSnapshot } from '../domain/election.ts'
import { REGIONS, resultsUrl, scopeName, sumRegions } from '../domain/regions.ts'
import type { RegionCode, RegionResult } from '../domain/regions.ts'
import { statePaths } from '../data/statePaths.ts'
import { useElectionResults } from '../hooks/useElectionResults.ts'
import { subscribeToRegions } from '../services/electionStore.ts'
import { downloadChart } from '../utils/downloadChart.ts'
import { formatNumber, formatPercent, formatTime } from '../utils/format.ts'
import { HistoryChart } from './HistoryChart.tsx'

function regionLeader(snapshot: ElectionSnapshot | null) {
  if (!snapshot || snapshot.validVotes === 0) return 'pending'
  const [flavio, lula] = snapshot.candidates
  return flavio.votes === lula.votes ? 'tied' : flavio.votes > lula.votes ? 'flavio' : 'lula'
}

function RegionDetail({ code }: { code: RegionCode }) {
  const { snapshot, history, error, isFetching } = useElectionResults(code)
  const chartHistory = history.filter((point) => point.timestamp >= CHART_START_AT)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)
  async function exportImage() {
    if (!snapshot || exporting) return
    setExporting(true); setExportError(false)
    try { await downloadChart(snapshot, chartHistory) }
    catch { setExportError(true) }
    finally { setExporting(false) }
  }
  return <div className="region-detail" id="region-details">
    <div className="region-detail-heading">
      <div><span className="eyebrow">PRESIDENTE · {code === 'zz' ? 'VOTOS NO EXTERIOR' : code.toUpperCase()}</span><h3>{scopeName(code)}</h3></div>
      <button className="refresh-button" disabled={!snapshot || exporting} onClick={() => void exportImage()} aria-label={`Exportar gráfico de ${scopeName(code)}`}><Download size={15} /> PNG</button>
    </div>
    {error && <p className="region-error" role="status">{error}</p>}
    {exportError && <p className="region-error" role="alert">Não foi possível exportar. Tente novamente.</p>}
    {snapshot ? <>
      <div className="region-candidates">
        {snapshot.candidates.map((candidate) => <div className={`region-candidate ${candidate.key}`} key={candidate.key}>
          <span>{candidate.name}</span><strong>{formatPercent(candidate.percent)}<small>%</small></strong><span className="tabular">{formatNumber(candidate.votes)} votos</span>
        </div>)}
      </div>
      <div className="region-progress"><span><strong>{formatPercent(snapshot.sectionsPercent)}%</strong> das seções totalizadas</span><span>Parcial das <strong>{formatTime(snapshot.generatedAt)}</strong></span></div>
      <HistoryChart history={chartHistory} headingId={`history-${code}`} />
      <dl className="region-totals"><div><dt>Votos contabilizados</dt><dd>{formatNumber(snapshot.totalVotes)}</dd></div><div><dt>Brancos / nulos</dt><dd>{formatNumber(snapshot.blankVotes)} / {formatNumber(snapshot.nullVotes)}</dd></div><div><dt>Seções totalizadas</dt><dd>{formatNumber(snapshot.countedSections)} / {formatNumber(snapshot.totalSections)}</dd></div></dl>
      <div className="region-source"><span>{snapshot.finished ? 'Totalização concluída' : 'Parciais atualizadas automaticamente'}</span><a href={resultsUrl(code)} target="_blank" rel="noreferrer">Dados do TSE <ArrowUpRight size={13} /></a></div>
    </> : <div className="region-awaiting" aria-busy={isFetching}>Aguardando a primeira parcial de {scopeName(code)} na nuvem.</div>}
  </div>
}

export function RegionalExplorer({ national }: { national: ElectionSnapshot | null }) {
  const [regions, setRegions] = useState<RegionResult[]>([])
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<RegionCode | null>(null)
  useEffect(() => subscribeToRegions((results) => { setRegions(results); setError(false) }, () => setError(true)), [])
  const total = sumRegions(regions)
  const byCode = new Map(regions.map((result) => [result.code, result]))
  const receivedStates = regions.filter(({ code, snapshot }) => code !== 'zz' && snapshot).length
  const failures = regions.filter(({ error }) => error).length

  return <section className="regional-section" aria-labelledby="regional-title">
    <div className="regional-heading"><div><span className="eyebrow">O PAÍS, ESTADO POR ESTADO</span><h2 id="regional-title">Apuração pelo Brasil</h2><p>Clique em um estado para acompanhar seus votos e a evolução.</p></div><span className="subtle-badge">{receivedStates}/27 UFs recebidas</span></div>
    {error && <p className="notice" role="status">A conexão com os resultados estaduais foi interrompida. Os dados recebidos continuam visíveis.</p>}
    <div className="regional-sum panel">
      <div><span className="eyebrow">SOMA DAS PARCIAIS REGIONAIS</span><span className="sum-coverage">{receivedStates} UFs{total.hasExterior ? ' + exterior' : ' · aguardando exterior'}</span></div>
      <div className="sum-candidate flavio"><span>Flávio Bolsonaro</span><strong>{total.available ? `${formatPercent(total.flavioPercent)}%` : '—'}</strong><small>{formatNumber(total.flavio)} votos</small></div>
      <div className="sum-candidate lula"><span>Lula</span><strong>{total.available ? `${formatPercent(total.lulaPercent)}%` : '—'}</strong><small>{formatNumber(total.lula)} votos</small></div>
      <p>Arquivos atualizados em horários diferentes; esta soma pode diferir do consolidado nacional do TSE.{national && total.available > 0 && <> Diferença atual: <strong>{formatNumber(Math.abs(total.totalVotes - national.totalVotes))} votos contabilizados</strong>.</>}{total.oldestAt !== null && <> Parciais entre {formatTime(total.oldestAt)} e {formatTime(total.newestAt!)}.</>}{failures > 0 && <> {failures} {failures === 1 ? 'região com falha na última coleta' : 'regiões com falha na última coleta'}.</>}</p>
    </div>
    <div className={`regional-body ${selected ? 'has-selection' : ''}`}>
      <div className="panel map-panel">
        <div className="map-legend"><span><i className="legend-dot flavio-dot" />Flávio à frente</span><span><i className="legend-dot lula-dot" />Lula à frente</span><span><i className="legend-dot pending-dot" />Sem votos / empate</span></div>
        <svg viewBox="0 0 620 610" className="brazil-map" aria-label="Mapa dos estados brasileiros, coloridos pelo candidato com mais votos">
          {statePaths.map(({ code, path, x, y }) => {
            const result = byCode.get(code)
            const snapshot = result?.snapshot ?? null
            return <a key={code} href="#region-details" onClick={(event) => { event.preventDefault(); setSelected(code) }} aria-label={`Ver evolução de ${scopeName(code)}`} className={`map-state ${regionLeader(snapshot)} ${selected === code ? 'selected' : ''}`}>
              <title>{scopeName(code)}{snapshot ? ` · Flávio ${formatPercent(snapshot.candidates[0].percent)}% · Lula ${formatPercent(snapshot.candidates[1].percent)}% · ${formatPercent(snapshot.sectionsPercent)}% das seções` : ' · aguardando parcial'}</title>
              <path d={path} /><text x={x} y={y} textAnchor="middle" dominantBaseline="middle">{code.toUpperCase()}</text>
            </a>
          })}
        </svg>
        <div className="state-picker" aria-label="Selecionar estado ou exterior">
          {REGIONS.map(({ code, name }) => <button key={code} title={name} aria-pressed={selected === code} onClick={() => setSelected(code)} className={`state-chip ${regionLeader(byCode.get(code)?.snapshot ?? null)} ${selected === code ? 'selected' : ''}`}>{code === 'zz' ? 'Exterior' : code.toUpperCase()}</button>)}
        </div>
        <p className="map-attribution">Malha geográfica: <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noreferrer">IBGE</a> · Cores indicam a liderança na parcial.</p>
      </div>
      {selected ? <RegionDetail key={selected} code={selected} /> : <div className="panel region-placeholder"><MapPin size={30} strokeWidth={1.5} /><h3>De perto, em cada estado.</h3><p>Selecione uma UF no mapa ou nas siglas para ver os percentuais, os votos e o gráfico de evolução.</p><span>O histórico começa com as parciais recebidas a partir da ativação da coleta estadual.</span></div>}
    </div>
  </section>
}
