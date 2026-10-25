import { ArrowUpRight, ChartNoAxesColumnIncreasing, CircleAlert, CircleCheck, Clock3, Download, ExternalLink, RefreshCw } from 'lucide-react'
import { CHART_START_AT, STALE_AFTER_MS, TSE_PORTAL_URL, TSE_RESULTS_URL } from '../config.ts'
import { CandidateCard } from '../components/CandidateCard.tsx'
import { CountingProgress } from '../components/CountingProgress.tsx'
import { HistoryChart } from '../components/HistoryChart.tsx'
import { RegionalExplorer } from '../components/RegionalExplorer.tsx'
import { useElectionResults } from '../hooks/useElectionResults.ts'
import { useNow } from '../hooks/useNow.ts'
import { downloadChart } from '../utils/downloadChart.ts'
import { elapsedLabel, formatDate, formatNumber, formatPercent, formatTime } from '../utils/format.ts'

export function App() {
  const { snapshot, history, isFetching, error, lastSuccessAt, isFromCache, refresh } = useElectionResults()
  const chartHistory = history.filter((point) => point.timestamp >= CHART_START_AT)
  const now = useNow()
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const isStale = snapshot && !snapshot.finished && now - snapshot.generatedAt >= STALE_AFTER_MS
  const [flavio, lula] = snapshot?.candidates ?? []
  const leader = flavio && lula && flavio.votes !== lula.votes ? (flavio.votes > lula.votes ? flavio : lula) : null
  const difference = flavio && lula ? Math.abs(flavio.votes - lula.votes) : 0
  const percentDifference = flavio && lula ? Math.abs(flavio.percent - lula.percent) : 0

  const statusText = error ? 'Sincronização indisponível'
    : snapshot?.finished ? 'Totalização concluída'
    : !snapshot ? 'Aguardando coleta na nuvem'
    : snapshot.countedSections === 0 ? 'Aguardando os primeiros votos'
    : isStale ? 'Aguardando nova parcial' : 'Apuração em andamento'

  async function exportChart() {
    if (!snapshot || isExporting) return
    setIsExporting(true)
    setExportError(null)
    try {
      await downloadChart(snapshot, chartHistory)
    } catch {
      setExportError('Não foi possível gerar a imagem. Tente exportar novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Apuração, início">
          <span className="brand-icon"><ChartNoAxesColumnIncreasing size={22} strokeWidth={1.8} /></span>
          <span>apuração<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-right">
          <span className={`status-pill ${error || isStale ? 'warning' : snapshot?.finished ? 'complete' : ''}`}>
            <span className="status-dot" />{statusText}
          </span>
          <span className="desktop-detail">Dados oficiais · TSE</span>
        </div>
      </header>

      <main>
        <section className="page-heading" aria-label="Eleição e horário da parcial">
          <div>
            <p className="eyebrow">BRASIL <span>/</span> 2º TURNO <span>/</span> ELEIÇÕES 2026</p>
            <h1>Presidente da República</h1>
            <p className="page-subtitle">Os números da eleição, em uma tela.</p>
          </div>
          <div className="source-time">
            <span className="eyebrow">PARCIAL GERADA PELO TSE</span>
            <strong className="tabular">{snapshot ? formatTime(snapshot.generatedAt) : '—:—:—'}</strong>
            <span>{snapshot ? formatDate(snapshot.generatedAt) : 'Aguardando consulta'} · Brasília</span>
          </div>
        </section>

        <div className="update-toolbar">
          <div className="update-description">
            {snapshot?.finished ? <CircleCheck size={15} /> : <Clock3 size={15} />}
            <span>{snapshot?.finished ? 'Resultado final informado pelo TSE'
              : isFetching ? 'Sincronizando os dados…'
              : isFromCache ? 'Reconectando ao Firestore…' : 'Firestore em tempo real'}</span>
            {!snapshot?.finished && <span className="toolbar-secondary">Coleta na nuvem a cada 60s</span>}
          </div>
          <div className="toolbar-actions">
            <button className="refresh-button" onClick={() => void exportChart()} disabled={!snapshot || isExporting}
              title="Baixar imagem PNG com evolução, percentuais e votos">
              <Download size={14} />
              <span>{isExporting ? 'Gerando imagem…' : 'Exportar gráfico'}</span>
            </button>
            <button className="refresh-button" onClick={refresh} disabled={isFetching}>
              <RefreshCw size={14} className={isFetching ? 'spin' : ''} />
              <span>{isFetching ? 'Sincronizando' : 'Sincronizar agora'}</span>
            </button>
          </div>
        </div>

        {exportError && (
          <div className="notice error-notice" role="alert">
            <CircleAlert size={17} />
            <p>{exportError}</p>
          </div>
        )}
        {error && (
          <div className="notice error-notice" role="alert">
            <CircleAlert size={17} />
            <p>{error}{snapshot && ' A última parcial recebida continua visível.'}</p>
          </div>
        )}
        {isStale && !error && (
          <div className="notice stale-notice" role="status">
            <Clock3 size={16} />
            <p>A última parcial recebida é de <strong>{elapsedLabel(now - snapshot.generatedAt)} atrás</strong>. A coleta continua na nuvem e novas parciais aparecem automaticamente.</p>
          </div>
        )}

        {snapshot ? (
          <>
            <div className="candidates-grid">
              {snapshot.candidates.map((candidate) => <CandidateCard key={candidate.key} candidate={candidate} />)}
            </div>

            <section className="margin-summary" aria-label="Diferença entre os candidatos">
              <div>
                <span className={`summary-icon ${leader?.key ?? ''}`}><ArrowUpRight size={17} /></span>
                <p>{leader ? <><strong>{leader.name}</strong> está à frente por <strong className="tabular">{formatNumber(difference)} votos</strong></>
                  : snapshot.totalVotes > 0 ? 'Os candidatos estão empatados nesta parcial.' : 'Aguardando os primeiros votos totalizados.'}</p>
              </div>
              <span>{leader ? <><strong className="tabular">{formatPercent(percentDifference)} p.p.</strong> de diferença</> : 'Percentuais oficiais dos votos válidos'}</span>
            </section>

            <div className="details-grid">
              <HistoryChart history={chartHistory} />
              <CountingProgress snapshot={snapshot} />
            </div>
          </>
        ) : (
          <section className="initial-state" aria-busy={isFetching}>
            <ChartNoAxesColumnIncreasing size={35} strokeWidth={1.3} />
            <h2>{error ? 'Aguardando conexão com o Firestore' : 'Aguardando a primeira parcial na nuvem'}</h2>
            <p>{error ? 'A sincronização será retomada quando a conexão voltar. Você também pode tentar sincronizar agora.'
              : 'Os resultados aparecem automaticamente assim que o coletor registrar uma parcial do TSE.'}</p>
          </section>
        )}

        <RegionalExplorer national={snapshot} />

        <footer className="page-footer">
          <div>
            <a href={TSE_PORTAL_URL} target="_blank" rel="noreferrer">Fonte: Tribunal Superior Eleitoral <ExternalLink size={12} /></a>
            <p>Resultados parciais podem mudar. O horário acima é o da geração dos dados.</p>
          </div>
          <div className="footer-meta">
            <span>Última consulta na nuvem: <strong className="tabular">{lastSuccessAt ? formatTime(lastSuccessAt) : '—'}</strong></span>
            <a href={TSE_RESULTS_URL} target="_blank" rel="noreferrer">Ver dados da fonte <ArrowUpRight size={13} /></a>
          </div>
        </footer>
      </main>
    </div>
  )
}
import { useState } from 'react'
