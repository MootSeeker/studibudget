import { describe, expect, it } from 'vitest'
import { backupStatus } from './backup'

const now = new Date('2026-10-20T12:00:00Z')
const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()

describe('backupStatus', () => {
  it('Erinnerung aus (0 Tage): nie fällig', () => {
    expect(backupStatus({ backupReminderDays: 0, lastBackupAt: null }, now, true).due).toBe(false)
    expect(backupStatus({ backupReminderDays: 0, lastBackupAt: at(400) }, now, true).due).toBe(
      false,
    )
  })
  it('noch nie gesichert: fällig, sobald es Daten gibt', () => {
    expect(backupStatus({ backupReminderDays: 30, lastBackupAt: null }, now, true)).toEqual({
      due: true,
      daysSince: null,
    })
    expect(backupStatus({ backupReminderDays: 30, lastBackupAt: null }, now, false).due).toBe(false)
  })
  it('fällig ab genau so vielen Tagen wie eingestellt', () => {
    expect(backupStatus({ backupReminderDays: 7, lastBackupAt: at(6) }, now, true)).toEqual({
      due: false,
      daysSince: 6,
    })
    expect(backupStatus({ backupReminderDays: 7, lastBackupAt: at(7) }, now, true)).toEqual({
      due: true,
      daysSince: 7,
    })
    expect(backupStatus({ backupReminderDays: 14, lastBackupAt: at(10) }, now, true).due).toBe(
      false,
    )
    expect(backupStatus({ backupReminderDays: 30, lastBackupAt: at(45) }, now, true)).toEqual({
      due: true,
      daysSince: 45,
    })
  })
  it('ein kaputtes oder zukünftiges Datum gilt nicht als Absturz', () => {
    expect(backupStatus({ backupReminderDays: 7, lastBackupAt: 'kaputt' }, now, true)).toEqual({
      due: true,
      daysSince: null,
    })
    expect(backupStatus({ backupReminderDays: 7, lastBackupAt: at(-3) }, now, true).daysSince).toBe(
      0,
    )
  })
})
