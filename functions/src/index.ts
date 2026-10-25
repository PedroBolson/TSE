import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { parseTseResults } from '../../src/domain/election.ts'
import { REQUEST_TIMEOUT_MS, TSE_RESULTS_URL } from '../../src/config.ts'

initializeApp()
const db = getFirestore()
const stateRef = db.doc('elections/6258')

export const collectTseResults = onSchedule({
  schedule: '* * * * *',
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1',
  memory: '256MiB',
  cpu: 'gcf_gen1',
  minInstances: 0,
  maxInstances: 1,
  timeoutSeconds: 30,
  retryCount: 0,
}, async () => {
  const state = (await stateRef.get()).data()
  if (state?.finished || (typeof state?.nextAllowedAt === 'number' && state.nextAllowedAt > Date.now())) return

  let blocked = false
  try {
    const response = await fetch(TSE_RESULTS_URL, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      blocked = response.status === 403 || response.status === 429
      throw new Error(`O TSE respondeu HTTP ${response.status}.`)
    }
    const raw: unknown = await response.json()
    const snapshot = parseTseResults(raw)
    const collectedAt = Date.now()
    const partialRef = stateRef.collection('partials').doc(snapshot.id)

    const created = await db.runTransaction(async (transaction) => {
      const [current, partial] = await transaction.getAll(stateRef, partialRef)
      const latest = current.data()
      const isLatest = !latest || typeof latest.generatedAt !== 'number' || snapshot.generatedAt >= latest.generatedAt
      if (!partial.exists) {
        transaction.create(partialRef, { generatedAt: snapshot.generatedAt, collectedAt, raw })
      }
      transaction.set(stateRef, {
        lastCheckedAt: collectedAt,
        lastSuccessAt: collectedAt,
        error: null,
        nextAllowedAt: null,
        ...(isLatest ? {
          latestId: snapshot.id,
          generatedAt: snapshot.generatedAt,
          finished: snapshot.finished,
          sourceUrl: TSE_RESULTS_URL,
        } : {}),
      }, { merge: true })
      return !partial.exists
    })
    if (created) logger.info('Nova parcial registrada.', { id: snapshot.id, sectionsPercent: snapshot.sectionsPercent })
  } catch (failure) {
    const detail = failure instanceof Error ? failure.message : 'Erro desconhecido.'
    await stateRef.set({
      lastCheckedAt: Date.now(),
      error: `A coleta na nuvem não conseguiu atualizar os dados. ${detail}`,
      nextAllowedAt: blocked ? Date.now() + 10 * 60_000 : null,
    }, { merge: true })
    logger.error('Falha na coleta do TSE.', { detail, blocked })
  }
})
