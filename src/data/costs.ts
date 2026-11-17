import { useLiveQuery } from 'dexie-react-hooks'
import { addCost, addToLedger, type CostKind, type CostLedger } from '../engine/llm/costs'
import type { LlmUsage } from '../engine/llm/types'
import { db } from './db'

const LEDGER_KEY = 'costLedger'

/**
 * Enregistre un appel à l'IA : dans la partie (coût total, détail, tours joués)
 * et dans le registre mensuel global, qui survit à la suppression des parties.
 */
export async function recordCost(
  sessionId: string | null,
  kind: CostKind,
  result: { costUsd: number; usage?: Partial<LlmUsage> },
  turns = 0,
): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.sessions, db.meta, async () => {
    if (sessionId) {
      const s = await db.sessions.get(sessionId)
      if (s)
        await db.sessions.update(sessionId, {
          costUsd: s.costUsd + result.costUsd,
          turn: s.turn + turns,
          costs: addCost(s.costs, kind, result.costUsd, result.usage),
        })
    }
    const entry = await db.meta.get(LEDGER_KEY)
    await db.meta.put({ key: LEDGER_KEY, value: addToLedger(entry?.value as CostLedger | undefined, now, kind, result.costUsd, result.usage) })
  })
}

export function useCostLedger(): CostLedger | undefined {
  return useLiveQuery(async () => ((await db.meta.get(LEDGER_KEY))?.value as CostLedger | undefined) ?? {}, [])
}

export async function resetCostLedger(): Promise<void> {
  await db.meta.delete(LEDGER_KEY)
}
