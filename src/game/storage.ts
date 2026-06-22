import type { HistoryRecord } from './types'

const HISTORY_KEY = 'freeze.challenge.history.v1'
const HISTORY_LIMIT = 5

export function loadHistory(): HistoryRecord[] {
  try {
    const rawValue = window.localStorage.getItem(HISTORY_KEY)
    if (!rawValue) return []

    const parsedValue: unknown = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) return []

    return parsedValue.filter(isHistoryRecord).slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function saveHistory(records: HistoryRecord[]): void {
  window.localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(records.slice(0, HISTORY_LIMIT)),
  )
}

export function clearHistory(): void {
  window.localStorage.removeItem(HISTORY_KEY)
}

export function getBestTargetDiff(records: HistoryRecord[]): number | null {
  const targetDiffs = records
    .map((record) => record.diffSeconds)
    .filter((diff): diff is number => typeof diff === 'number')

  if (targetDiffs.length === 0) return null
  return Math.min(...targetDiffs)
}

function isHistoryRecord(value: unknown): value is HistoryRecord {
  if (!value || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    (record.mode === 'target' || record.mode === 'redlight') &&
    typeof record.label === 'string' &&
    typeof record.detail === 'string' &&
    typeof record.scoreLabel === 'string' &&
    typeof record.createdAt === 'string'
  )
}
