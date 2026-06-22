export type GameMode = 'target' | 'redlight'

export type GamePhase = 'idle' | 'countdown' | 'playing' | 'result'

export type PointerStatus = 'outside' | 'moving' | 'frozen'

export type RedLightSignal = 'move' | 'freeze'

export type ResultTone = 'elite' | 'good' | 'miss' | 'survive' | 'caught'

export interface PointerSnapshot {
  inArena: boolean
  moving: boolean
  idleForMs: number
  x: number
  y: number
}

export interface TargetResult {
  mode: 'target'
  targetSeconds: number
  stoppedSeconds: number
  diffSeconds: number
  score: number
  tone: ResultTone
}

export interface RedLightResult {
  mode: 'redlight'
  survived: boolean
  durationSeconds: number
  elapsedSeconds: number
  score: number
  tone: ResultTone
}

export type GameResult = TargetResult | RedLightResult

export interface HistoryRecord {
  id: string
  mode: GameMode
  label: string
  detail: string
  scoreLabel: string
  diffSeconds?: number
  createdAt: string
}
