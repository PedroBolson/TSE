import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { parseTseResults } from '../../src/domain/election.ts'
import { REGIONS, resultsUrl } from '../../src/domain/regions.ts'
import type { ElectionScope } from '../../src/domain/regions.ts'
import { REQUEST_TIMEOUT_MS } from '../../src/config.ts'

initializeApp()
const db = getFirestore()
const nationalRef = db.doc('elections/6258')

export const collectTseResults = onSchedule({
  schedule: '* * * * *', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1',
  memory: '256MiB', cpu: 'gcf_gen1', minInstances: 0, maxInstances: 1,
  timeoutSeconds: 120, retryCount: 0,
}, async () => {
  const scopes: ElectionScope[] = ['br', ...REGIONS.map(({ code }) => code)]
  const refs = scopes.map((scope) => scope === 'br' ? nationalRef : nationalRef.collection('regions').doc(scope))
  const states = await db.getAll(...refs)
  const national = states[0].data()
  if (typeof national?.nextAllowedAt === 'number' && national.nextAllowedAt > Date.now()) return
  let blocked = false

  async function collect(index: number) {
    const scope = scopes[index]
    const stateRef = refs[index]
    const state = states[index].data()
    if (state?.finished || (typeof state?.nextAllowedAt === 'number' && state.nextAllowedAt > Date.now())) return
    const sourceUrl = resultsUrl(scope)
    try {
      const response = await fetch(sourceUrl, {
        headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!response.ok) {
        if (response.status === 403 || response.status === 429) blocked = true
        throw new Error(`O TSE respondeu HTTP ${response.status}.`)
      }
      const raw: unknown = await response.json()
      const snapshot = parseTseResults(raw, scope)
      const collectedAt = Date.now()
      const partialRef = stateRef.collection('partials').doc(snapshot.id)
      const created = await db.runTransaction(async (transaction) => {
        const [current, partial] = await transaction.getAll(stateRef, partialRef)
        const latest = current.data()
        const isLatest = !latest || typeof latest.generatedAt !== 'number' || snapshot.generatedAt >= latest.generatedAt
        if (!partial.exists) transaction.create(partialRef, { generatedAt: snapshot.generatedAt, collectedAt, raw })
        // Regional summaries change only on a new partial or recovery, avoiding 28 heartbeat writes per minute.
        if (scope === 'br' || !partial.exists || latest?.error || !latest?.raw) {
          transaction.set(stateRef, {
            lastCheckedAt: collectedAt, lastSuccessAt: collectedAt, error: null, nextAllowedAt: null,
            ...(isLatest ? {
              latestId: snapshot.id, generatedAt: snapshot.generatedAt, finished: snapshot.finished, sourceUrl,
              ...(scope !== 'br' ? { raw } : {}),
            } : {}),
          }, { merge: true })
        }
        return !partial.exists
      })
      if (created) logger.info('Nova parcial registrada.', { scope, id: snapshot.id, sectionsPercent: snapshot.sectionsPercent })
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : 'Erro desconhecido.'
      await stateRef.set({
        lastCheckedAt: Date.now(), error: `A coleta de ${scope.toUpperCase()} não conseguiu atualizar os dados. ${detail}`,
        nextAllowedAt: blocked ? Date.now() + 10 * 60_000 : null,
      }, { merge: true })
      logger.error('Falha na coleta do TSE.', { scope, detail, blocked })
    }
  }

  // Keep the national update first. Isolate state failures and limit parallel requests.
  await collect(0)
  let next = 1
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (!blocked && next < scopes.length) {
      const index = next++
      await collect(index)
    }
  }))
  if (blocked) await nationalRef.set({ nextAllowedAt: Date.now() + 10 * 60_000 }, { merge: true })
})
