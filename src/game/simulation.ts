import type {
  GameMode,
  GameResult,
  HistoryRecord,
  RedLightResult,
  RedLightSignal,
  ResultTone,
  TargetResult,
} from './types'

export const TARGET_MIN_SECONDS = 3
export const TARGET_MAX_SECONDS = 15
export const TARGET_HIDE_WINDOW_SECONDS = 0.5
export const TARGET_AUTO_END_GRACE_SECONDS = 3
export const FREEZE_DEBOUNCE_MS = 190

export const RED_LIGHT_MIN_SECONDS = 8
export const RED_LIGHT_MAX_SECONDS = 15
export const RED_LIGHT_MAX_SCORE = 100

export function pickTargetSeconds(): number {
  return round2(randomBetween(TARGET_MIN_SECONDS, TARGET_MAX_SECONDS))
}

export function pickRedLightDurationSeconds(): number {
  return round2(randomBetween(RED_LIGHT_MIN_SECONDS, RED_LIGHT_MAX_SECONDS))
}

export function pickSignalDelayMs(): number {
  return Math.round(randomBetween(820, 2200))
}

export function nextSignal(current: RedLightSignal): RedLightSignal {
  return current === 'move' ? 'freeze' : 'move'
}

export function buildTargetResult(
  targetSeconds: number,
  stoppedSeconds: number,
): TargetResult {
  const diffSeconds = round2(Math.abs(stoppedSeconds - targetSeconds))
  const score = Math.max(0, Math.round(100 - diffSeconds * 22))
  let tone: ResultTone = 'miss'

  if (diffSeconds <= 0.15) tone = 'elite'
  else if (diffSeconds <= 0.5) tone = 'good'

  return {
    mode: 'target',
    targetSeconds,
    stoppedSeconds: round2(stoppedSeconds),
    diffSeconds,
    score,
    tone,
  }
}

export function buildRedLightResult(
  survived: boolean,
  durationSeconds: number,
  elapsedSeconds: number,
  score: number,
): RedLightResult {
  return {
    mode: 'redlight',
    survived,
    durationSeconds: round2(durationSeconds),
    elapsedSeconds: round2(elapsedSeconds),
    score: survived ? Math.round(score) : 0,
    tone: survived ? 'survive' : 'caught',
  }
}

export function createHistoryRecord(result: GameResult): HistoryRecord {
  const createdAt = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  if (result.mode === 'target') {
    return {
      id: crypto.randomUUID(),
      mode: 'target',
      label: 'Target Freeze',
      detail: `${formatSeconds(result.targetSeconds)} 목표 / ${formatSeconds(
        result.stoppedSeconds,
      )} 정지`,
      scoreLabel: `${formatSeconds(result.diffSeconds)} 오차`,
      diffSeconds: result.diffSeconds,
      createdAt,
    }
  }

  return {
    id: crypto.randomUUID(),
    mode: 'redlight',
    label: 'Red Light',
    detail: result.survived
      ? `${formatSeconds(result.durationSeconds)} 생존`
      : `${formatSeconds(result.elapsedSeconds)} 버팀`,
    scoreLabel: result.survived ? `${result.score}점` : '감지됨',
    createdAt,
  }
}

export function modeLabel(mode: GameMode): string {
  return mode === 'target' ? 'Target Freeze' : 'Red Light'
}

export function formatSeconds(value: number): string {
  return `${value.toFixed(2)}초`
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
