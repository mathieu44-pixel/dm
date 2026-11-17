/** Rappel de sauvegarde (v0.9.3) : tout est stocké sur l'appareil, un export protège des pertes. */

export const BACKUP_REMINDER = { firstAfterTurns: 10, everyDays: 7, snoozeDays: 3 } as const
const DAY = 24 * 60 * 60 * 1000

export interface BackupState {
  lastBackupAt?: number
  snoozedUntil?: number
  /** Dernière partie jouée (toutes histoires confondues). */
  lastPlayedAt?: number
  totalTurns: number
}

export function needsBackupReminder(state: BackupState, now = Date.now()): boolean {
  if (!state.lastPlayedAt) return false
  if (state.snoozedUntil && state.snoozedUntil > now) return false
  if (!state.lastBackupAt) return state.totalTurns >= BACKUP_REMINDER.firstAfterTurns
  return state.lastPlayedAt > state.lastBackupAt && now - state.lastBackupAt >= BACKUP_REMINDER.everyDays * DAY
}

export function daysSince(timestamp: number | undefined, now = Date.now()): number | null {
  return timestamp ? Math.floor((now - timestamp) / DAY) : null
}
