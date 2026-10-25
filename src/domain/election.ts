export type CandidateKey = 'flavio' | 'lula'

export interface Candidate {
  key: CandidateKey
  number: string
  name: string
  party: string
  votes: number
  percent: number
}

export interface ElectionSnapshot {
  id: string
  generatedAt: number
  candidates: [Candidate, Candidate]
  sectionsPercent: number
  countedSections: number
  totalSections: number
  totalVotes: number
  validVotes: number
  blankVotes: number
  nullVotes: number
  finished: boolean
}

export interface HistoryPoint {
  id: string
  timestamp: number
  flavio: number
  lula: number
  flavioVotes?: number
  lulaVotes?: number
  sectionsPercent: number
}

type JsonObject = Record<string, unknown>
const HISTORY_LIMIT = 720

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('O TSE retornou um formato de dados inesperado.')
  }
  return value as JsonObject
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('O TSE retornou uma lista de dados incompleta.')
  }
  return value
}

function numeric(value: unknown, percentage = false): number {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    (typeof value === 'string' && !/^\d+(?:[.,]\d+)?$/.test(value))
  ) {
    throw new Error('A parcial contém um valor numérico inválido.')
  }
  const parsed = Number(String(value).replace(',', '.'))
  if (
    !Number.isFinite(parsed) || parsed < 0 ||
    (percentage ? parsed > 100 : !Number.isSafeInteger(parsed))
  ) {
    throw new Error('A parcial contém um valor fora do intervalo esperado.')
  }
  return parsed
}

function brazilTimestamp(date: unknown, time: unknown): number {
  if (typeof date !== 'string' || typeof time !== 'string') {
    throw new Error('A parcial não informa a data e a hora de geração.')
  }
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2}):(\d{2})$/.exec(time)
  if (!dateMatch || !timeMatch) throw new Error('Data da parcial inválida.')

  const [, day, month, year] = dateMatch.map(Number)
  const [, hour, minute, second] = timeMatch.map(Number)
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  if (
    wallClock.getUTCFullYear() !== year || wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day || wallClock.getUTCHours() !== hour ||
    wallClock.getUTCMinutes() !== minute || wallClock.getUTCSeconds() !== second
  ) {
    throw new Error('Data da parcial inválida.')
  }
  // A divulgação eleitoral usa o horário de Brasília (UTC−3 em 2026).
  return wallClock.getTime() + 3 * 60 * 60 * 1_000
}

export function parseTseResults(payload: unknown): ElectionSnapshot {
  const data = object(payload)
  if (data.ele !== '6258' || data.t !== '2' || data.f !== 'o' || data.cdabr !== 'br') {
    throw new Error('O arquivo não corresponde à eleição presidencial oficial do 2º turno de 2026.')
  }
  if (typeof data.idg !== 'string' || !data.idg) {
    throw new Error('A parcial não tem identificador de geração.')
  }

  const presidentialRace = array(data.carg).map(object).find((race) => race.cd === '1')
  if (!presidentialRace) throw new Error('O arquivo não contém o resultado de presidente.')
  const candidates = array(presidentialRace.agr).flatMap((group) =>
    array(object(group).par).flatMap((party) => array(object(party).cand).map(object)),
  )

  const candidate = (key: CandidateKey, number: string, name: string, party: string): Candidate => {
    const raw = candidates.find((item) => item.n === number)
    if (!raw) throw new Error(`A parcial não contém os dados de ${name}.`)
    return { key, number, name, party, votes: numeric(raw.vap), percent: numeric(raw.pvap, true) }
  }

  const sections = object(data.s)
  const votes = object(data.v)
  return {
    id: data.idg,
    generatedAt: brazilTimestamp(data.dg, data.hg),
    candidates: [
      candidate('flavio', '22', 'Flávio Bolsonaro', 'PL'),
      candidate('lula', '13', 'Lula', 'PT'),
    ],
    sectionsPercent: numeric(sections.pst, true),
    countedSections: numeric(sections.st),
    totalSections: numeric(sections.ts),
    totalVotes: numeric(votes.tv),
    validVotes: numeric(votes.vv),
    blankVotes: numeric(votes.vb),
    nullVotes: numeric(votes.tvn),
    finished: data.and === 'f',
  }
}

export function newerSnapshot(
  current: ElectionSnapshot | null,
  incoming: ElectionSnapshot,
): ElectionSnapshot {
  // Uma resposta antiga de cache não deve fazer o painel andar para trás.
  return current && current.generatedAt > incoming.generatedAt ? current : incoming
}

export function appendHistory(history: HistoryPoint[], snapshot: ElectionSnapshot): HistoryPoint[] {
  if (snapshot.countedSections === 0) return history
  const latest = history.at(-1)
  if (latest && latest.timestamp > snapshot.generatedAt) return history
  if (latest?.id === snapshot.id &&
    latest.flavioVotes === snapshot.candidates[0].votes &&
    latest.lulaVotes === snapshot.candidates[1].votes) return history
  const point: HistoryPoint = {
    id: snapshot.id,
    timestamp: snapshot.generatedAt,
    flavio: snapshot.candidates[0].percent,
    lula: snapshot.candidates[1].percent,
    flavioVotes: snapshot.candidates[0].votes,
    lulaVotes: snapshot.candidates[1].votes,
    sectionsPercent: snapshot.sectionsPercent,
  }
  // Regerações no mesmo segundo atualizam o ponto existente.
  const previous = latest?.timestamp === point.timestamp ? history.slice(0, -1) : history
  return [...previous, point].slice(-HISTORY_LIMIT)
}

export function restoreHistory(serialized: string | null): HistoryPoint[] {
  if (!serialized) return []
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!Array.isArray(parsed)) return []
    const valid = parsed.filter((item): item is HistoryPoint => {
      if (!item || typeof item !== 'object') return false
      const value = item as Partial<HistoryPoint>
      return typeof value.id === 'string' && value.id.length > 0 &&
        typeof value.timestamp === 'number' && Number.isFinite(value.timestamp) && value.timestamp > 0 &&
        [value.flavio, value.lula, value.sectionsPercent].every(
          (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100,
        ) && [value.flavioVotes, value.lulaVotes].every(
          (n) => n === undefined || (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0),
        )
    })
    const byTimestamp = new Map(valid.map((point) => [point.timestamp, point]))
    return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function mergeCloudHistory(local: HistoryPoint[], snapshots: readonly ElectionSnapshot[]): HistoryPoint[] {
  const byTimestamp = new Map(local.map((point) => [point.timestamp, point]))
  for (const snapshot of snapshots) {
    if (snapshot.countedSections === 0) continue
    byTimestamp.set(snapshot.generatedAt, {
      id: snapshot.id,
      timestamp: snapshot.generatedAt,
      flavio: snapshot.candidates[0].percent,
      lula: snapshot.candidates[1].percent,
      flavioVotes: snapshot.candidates[0].votes,
      lulaVotes: snapshot.candidates[1].votes,
      sectionsPercent: snapshot.sectionsPercent,
    })
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-HISTORY_LIMIT)
}
