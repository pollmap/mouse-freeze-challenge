import '@fontsource/orbitron/700.css'
import {
  CircleStop,
  Crown,
  MousePointer2,
  OctagonAlert,
  Play,
  Radar,
  RotateCcw,
  ShieldCheck,
  ThumbsUp,
  Timer,
  TrafficCone,
  Trophy,
  createIcons,
} from 'lucide'
import './style.css'
import { GameAudio } from './game/audio'
import { PointerTracker } from './game/input'
import {
  FREEZE_DEBOUNCE_MS,
  RED_LIGHT_MAX_SCORE,
  TARGET_AUTO_END_GRACE_SECONDS,
  TARGET_HIDE_WINDOW_SECONDS,
  buildRedLightResult,
  buildTargetResult,
  createHistoryRecord,
  formatSeconds,
  modeLabel,
  nextSignal,
  pickRedLightDurationSeconds,
  pickSignalDelayMs,
  pickTargetSeconds,
} from './game/simulation'
import { clearHistory, getBestTargetDiff, loadHistory, saveHistory } from './game/storage'
import type {
  GameMode,
  GamePhase,
  GameResult,
  HistoryRecord,
  PointerStatus,
  RedLightSignal,
} from './game/types'

interface AppState {
  mode: GameMode
  phase: GamePhase
  countdown: number
  targetSeconds: number
  targetStartAt: number
  redLightDurationSeconds: number
  redLightStartAt: number
  redLightSignal: RedLightSignal
  redLightSignalChangedAt: number
  redLightScore: number
  result: GameResult | null
  history: HistoryRecord[]
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root is missing.')
}

const state: AppState = {
  mode: 'target',
  phase: 'idle',
  countdown: 3,
  targetSeconds: 0,
  targetStartAt: 0,
  redLightDurationSeconds: 0,
  redLightStartAt: 0,
  redLightSignal: 'move',
  redLightSignalChangedAt: 0,
  redLightScore: 0,
  result: null,
  history: loadHistory(),
}

let frameId = 0
let countdownTimer: number | null = null
let signalTimer: number | null = null
let targetFreezeRegistered = false

const audio = new GameAudio()

app.innerHTML = `
  <div class="min-h-svh text-slate-100">
    <header class="border-b border-white/10 bg-[#0a0d12]/95">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <div class="grid size-11 shrink-0 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
            <i data-lucide="mouse-pointer-2" class="size-5"></i>
          </div>
          <div class="min-w-0">
            <p class="font-digital text-xl font-bold tracking-normal text-white">FREEZE!</p>
            <p class="truncate text-xs text-slate-400">mouse control challenge</p>
          </div>
        </div>
        <div class="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
          <span class="size-2 rounded-full bg-emerald-300"></span>
          <span>실시간 포인터 감지</span>
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-6xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[300px_1fr] lg:py-6">
      <aside class="order-2 space-y-4 lg:order-1">
        <section class="panel p-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-100">모드</h2>
            <span id="phase-badge" class="status-chip">대기</span>
          </div>
          <div class="grid gap-2" role="tablist" aria-label="게임 모드">
            <button id="mode-target" class="mode-button" type="button" title="Target Freeze">
              <i data-lucide="timer" class="size-4"></i>
              <span>Target Freeze</span>
            </button>
            <button id="mode-redlight" class="mode-button" type="button" title="Red Light">
              <i data-lucide="traffic-cone" class="size-4"></i>
              <span>Red Light</span>
            </button>
          </div>
        </section>

        <section class="panel p-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-100">기록</h2>
            <button id="clear-history" class="icon-button" type="button" title="기록 초기화" aria-label="기록 초기화">
              <i data-lucide="rotate-ccw" class="size-4"></i>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="metric-box">
              <span>최고 오차</span>
              <strong id="best-score">--</strong>
            </div>
            <div class="metric-box">
              <span>최근 결과</span>
              <strong id="latest-score">--</strong>
            </div>
          </div>
          <div id="history-list" class="mt-3 space-y-2"></div>
        </section>
      </aside>

      <section class="game-shell order-1 lg:order-2">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">current run</p>
            <h1 id="mode-title" class="mt-1 text-2xl font-bold tracking-normal text-white sm:text-3xl">Target Freeze</h1>
          </div>
          <div class="flex items-center gap-2">
            <span id="mouse-badge" class="status-chip">대기</span>
            <span id="signal-badge" class="status-chip hidden">MOVE</span>
          </div>
        </div>

        <div id="arena" class="arena" aria-live="polite">
          <div class="arena-grid"></div>
          <div class="relative z-10 grid h-full place-items-center">
            <div class="w-full max-w-2xl text-center">
              <div class="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div class="stat-tile">
                  <span>목표</span>
                  <strong id="target-display">--</strong>
                </div>
                <div class="stat-tile">
                  <span>경과</span>
                  <strong id="elapsed-display">0.00초</strong>
                </div>
                <div class="stat-tile col-span-2 sm:col-span-1">
                  <span>점수</span>
                  <strong id="score-display">--</strong>
                </div>
              </div>

              <p id="main-display" class="font-digital text-6xl font-bold tracking-normal text-white sm:text-7xl">READY</p>
              <p id="sub-display" class="mx-auto mt-4 min-h-12 max-w-xl text-sm leading-6 text-slate-300">
                시작하면 목표 시간이 정해집니다. 아레나 안에서 포인터를 움직이다가 정확한 순간 멈추세요.
              </p>

              <div id="progress-wrap" class="mx-auto mt-6 hidden h-3 max-w-md overflow-hidden rounded-full border border-white/10 bg-black/30">
                <div id="progress-bar" class="h-full w-0 rounded-full bg-emerald-300"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
          <button id="start-button" class="primary-button" type="button" title="게임 시작">
            <i data-lucide="play" class="size-5"></i>
            <span>시작</span>
          </button>
          <button id="stop-button" class="danger-button hidden" type="button" title="정지 판정">
            <i data-lucide="circle-stop" class="size-5"></i>
            <span>정지</span>
          </button>
        </div>
      </section>
    </main>

    <div id="result-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div class="modal-panel">
        <div id="result-icon" class="result-icon">
          <i data-lucide="trophy" class="size-8"></i>
        </div>
        <p id="result-kicker" class="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">result</p>
        <h2 id="result-title" class="mt-2 text-2xl font-bold text-white">결과</h2>
        <p id="result-copy" class="mt-3 text-sm leading-6 text-slate-300"></p>
        <div id="result-stats" class="mt-5 grid gap-2"></div>
        <button id="close-modal" class="primary-button mt-5 w-full" type="button">
          <i data-lucide="rotate-ccw" class="size-5"></i>
          <span>다시 하기</span>
        </button>
      </div>
    </div>
  </div>
`

const arena = query<HTMLElement>('#arena')
const pointer = new PointerTracker(arena)

const elements = {
  modeTarget: query<HTMLButtonElement>('#mode-target'),
  modeRedLight: query<HTMLButtonElement>('#mode-redlight'),
  phaseBadge: query<HTMLElement>('#phase-badge'),
  modeTitle: query<HTMLElement>('#mode-title'),
  mouseBadge: query<HTMLElement>('#mouse-badge'),
  signalBadge: query<HTMLElement>('#signal-badge'),
  targetDisplay: query<HTMLElement>('#target-display'),
  elapsedDisplay: query<HTMLElement>('#elapsed-display'),
  scoreDisplay: query<HTMLElement>('#score-display'),
  mainDisplay: query<HTMLElement>('#main-display'),
  subDisplay: query<HTMLElement>('#sub-display'),
  progressWrap: query<HTMLElement>('#progress-wrap'),
  progressBar: query<HTMLElement>('#progress-bar'),
  startButton: query<HTMLButtonElement>('#start-button'),
  stopButton: query<HTMLButtonElement>('#stop-button'),
  bestScore: query<HTMLElement>('#best-score'),
  latestScore: query<HTMLElement>('#latest-score'),
  historyList: query<HTMLElement>('#history-list'),
  clearHistory: query<HTMLButtonElement>('#clear-history'),
  modal: query<HTMLElement>('#result-modal'),
  resultIcon: query<HTMLElement>('#result-icon'),
  resultKicker: query<HTMLElement>('#result-kicker'),
  resultTitle: query<HTMLElement>('#result-title'),
  resultCopy: query<HTMLElement>('#result-copy'),
  resultStats: query<HTMLElement>('#result-stats'),
  closeModal: query<HTMLButtonElement>('#close-modal'),
}

elements.modeTarget.addEventListener('click', () => setMode('target'))
elements.modeRedLight.addEventListener('click', () => setMode('redlight'))
elements.startButton.addEventListener('click', startGame)
elements.stopButton.addEventListener('click', stopTargetGame)
elements.closeModal.addEventListener('click', closeResult)
elements.clearHistory.addEventListener('click', () => {
  state.history = []
  clearHistory()
  renderHistory()
})

renderStaticIcons()
renderMode()
renderHistory()
renderFrame()

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing element: ${selector}`)
  return element
}

function setMode(mode: GameMode): void {
  if (state.phase !== 'idle') return
  state.mode = mode
  state.result = null
  renderMode()
  renderIdle()
}

function startGame(): void {
  if (state.phase !== 'idle') return

  audio.enable()
  state.phase = 'countdown'
  state.countdown = 3
  state.result = null
  targetFreezeRegistered = false
  clearTimers()

  elements.startButton.disabled = true
  elements.stopButton.classList.add('hidden')
  tickCountdown()

  countdownTimer = window.setInterval(() => {
    state.countdown -= 1
    if (state.countdown <= 0) {
      clearCountdown()
      audio.play('start')
      launchSelectedMode()
      return
    }

    tickCountdown()
  }, 1000)
}

function tickCountdown(): void {
  audio.play('beep')
  elements.phaseBadge.textContent = '카운트다운'
  elements.mainDisplay.textContent = String(state.countdown)
  elements.subDisplay.textContent =
    state.mode === 'target'
      ? '아레나 안에서 포인터를 움직일 준비를 하세요.'
      : 'MOVE와 FREEZE 신호 전환에 집중하세요.'
}

function launchSelectedMode(): void {
  state.phase = 'playing'

  if (state.mode === 'target') {
    state.targetSeconds = pickTargetSeconds()
    state.targetStartAt = performance.now()
    elements.stopButton.classList.remove('hidden')
    elements.progressWrap.classList.add('hidden')
  } else {
    state.redLightDurationSeconds = pickRedLightDurationSeconds()
    state.redLightStartAt = performance.now()
    state.redLightSignal = 'move'
    state.redLightSignalChangedAt = state.redLightStartAt
    state.redLightScore = 0
    elements.stopButton.classList.add('hidden')
    elements.progressWrap.classList.remove('hidden')
    queueSignalFlip()
  }

  elements.startButton.classList.add('hidden')
  renderMode()
}

function stopTargetGame(): void {
  if (state.phase !== 'playing' || state.mode !== 'target') return
  finishTarget((performance.now() - state.targetStartAt) / 1000)
}

function finishTarget(stoppedSeconds: number): void {
  if (state.phase !== 'playing') return

  const result = buildTargetResult(state.targetSeconds, stoppedSeconds)
  completeRun(result)
}

function finishRedLight(survived: boolean): void {
  if (state.phase !== 'playing') return

  const elapsedSeconds = (performance.now() - state.redLightStartAt) / 1000
  const result = buildRedLightResult(
    survived,
    state.redLightDurationSeconds,
    elapsedSeconds,
    state.redLightScore,
  )

  completeRun(result)
}

function completeRun(result: GameResult): void {
  clearTimers()
  state.phase = 'result'
  state.result = result
  state.history = [createHistoryRecord(result), ...state.history].slice(0, 5)
  saveHistory(state.history)
  renderHistory()
  showResult(result)
}

function closeResult(): void {
  state.phase = 'idle'
  state.result = null
  elements.modal.classList.add('hidden')
  elements.startButton.disabled = false
  elements.startButton.classList.remove('hidden')
  elements.stopButton.classList.add('hidden')
  renderIdle()
}

function renderIdle(): void {
  targetFreezeRegistered = false
  elements.phaseBadge.textContent = '대기'
  elements.targetDisplay.textContent = state.mode === 'target' ? '랜덤' : '8-15초'
  elements.elapsedDisplay.textContent = '0.00초'
  elements.scoreDisplay.textContent = '--'
  elements.mainDisplay.textContent = 'READY'
  elements.subDisplay.textContent =
    state.mode === 'target'
      ? '시작하면 목표 시간이 정해집니다. 정확한 순간 포인터를 멈추세요.'
      : '초록 신호에는 움직이고, 빨간 신호에는 멈추세요.'
  elements.progressWrap.classList.toggle('hidden', state.mode === 'target')
  elements.progressBar.style.width = '0%'
  arena.dataset.signal = 'idle'
}

function renderMode(): void {
  elements.modeTitle.textContent = modeLabel(state.mode)
  elements.modeTarget.dataset.active = String(state.mode === 'target')
  elements.modeRedLight.dataset.active = String(state.mode === 'redlight')
  elements.signalBadge.classList.toggle('hidden', state.mode !== 'redlight')
  renderIdle()
}

function renderFrame(): void {
  const now = performance.now()
  const pointerStatus = pointer.getStatus(now)

  renderPointerStatus(pointerStatus)

  if (state.phase === 'playing' && state.mode === 'target') {
    renderTargetFrame(now)
  }

  if (state.phase === 'playing' && state.mode === 'redlight') {
    renderRedLightFrame(now)
  }

  frameId = window.requestAnimationFrame(renderFrame)
}

function renderTargetFrame(now: number): void {
  const elapsedSeconds = (now - state.targetStartAt) / 1000
  const isHiddenWindow = elapsedSeconds >= state.targetSeconds - TARGET_HIDE_WINDOW_SECONDS
  const snapshot = pointer.getSnapshot(now)

  elements.phaseBadge.textContent = '진행'
  elements.targetDisplay.textContent = formatSeconds(state.targetSeconds)
  elements.elapsedDisplay.textContent = formatSeconds(elapsedSeconds)
  elements.scoreDisplay.textContent = '정확도'
  elements.mainDisplay.textContent = isHiddenWindow ? '??.??' : elapsedSeconds.toFixed(2)
  elements.subDisplay.textContent = isHiddenWindow
    ? '타이머가 가려졌습니다. 감각으로 멈추는 구간입니다.'
    : '포인터를 계속 움직이다가 목표 시간에 멈추세요.'
  arena.dataset.signal = 'target'

  if (
    !targetFreezeRegistered &&
    snapshot.inArena &&
    snapshot.idleForMs >= FREEZE_DEBOUNCE_MS
  ) {
    const stoppedSeconds = Math.max(
      0,
      (now - snapshot.idleForMs - state.targetStartAt) / 1000,
    )

    if (Math.abs(stoppedSeconds - state.targetSeconds) <= 1) {
      targetFreezeRegistered = true
      finishTarget(stoppedSeconds)
    }
  }

  if (elapsedSeconds > state.targetSeconds + TARGET_AUTO_END_GRACE_SECONDS) {
    finishTarget(elapsedSeconds)
  }
}

function renderRedLightFrame(now: number): void {
  const elapsedSeconds = (now - state.redLightStartAt) / 1000
  const remainingRatio = Math.min(1, elapsedSeconds / state.redLightDurationSeconds)
  const snapshot = pointer.getSnapshot(now)

  elements.phaseBadge.textContent = '진행'
  elements.targetDisplay.textContent = formatSeconds(state.redLightDurationSeconds)
  elements.elapsedDisplay.textContent = formatSeconds(elapsedSeconds)
  elements.scoreDisplay.textContent = `${Math.round(state.redLightScore)}점`
  elements.mainDisplay.textContent = state.redLightSignal === 'move' ? 'MOVE' : 'FREEZE'
  elements.subDisplay.textContent =
    state.redLightSignal === 'move'
      ? '초록 구간입니다. 포인터를 움직여 점수를 채우세요.'
      : '빨간 구간입니다. 미세 움직임도 감지됩니다.'
  elements.signalBadge.textContent = state.redLightSignal === 'move' ? 'MOVE' : 'FREEZE'
  elements.progressBar.style.width = `${Math.max(
    remainingRatio * 100,
    state.redLightScore,
  )}%`
  elements.progressBar.className =
    state.redLightSignal === 'move'
      ? 'h-full rounded-full bg-emerald-300'
      : 'h-full rounded-full bg-red-400'
  arena.dataset.signal = state.redLightSignal

  if (state.redLightSignal === 'move') {
    state.redLightScore = snapshot.moving
      ? Math.min(RED_LIGHT_MAX_SCORE, state.redLightScore + 0.65)
      : Math.max(0, state.redLightScore - 0.15)
  }

  if (
    state.redLightSignal === 'freeze' &&
    now - state.redLightSignalChangedAt > 120 &&
    snapshot.moving
  ) {
    finishRedLight(false)
  }

  if (elapsedSeconds >= state.redLightDurationSeconds) {
    finishRedLight(true)
  }
}

function renderPointerStatus(status: PointerStatus): void {
  const labels: Record<PointerStatus, string> = {
    outside: '밖',
    moving: '움직임',
    frozen: '정지',
  }

  elements.mouseBadge.textContent = labels[status]
  elements.mouseBadge.dataset.status = status
}

function renderHistory(): void {
  const bestDiff = getBestTargetDiff(state.history)
  const latestRecord = state.history[0]

  elements.bestScore.textContent = bestDiff === null ? '--' : formatSeconds(bestDiff)
  elements.latestScore.textContent = latestRecord?.scoreLabel ?? '--'

  if (state.history.length === 0) {
    elements.historyList.innerHTML = `
      <p class="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-400">
        아직 기록이 없습니다.
      </p>
    `
    return
  }

  elements.historyList.innerHTML = state.history
    .map(
      (record) => `
        <article class="history-row">
          <div>
            <p class="text-sm font-bold text-slate-100">${record.label}</p>
            <p class="mt-0.5 text-xs text-slate-400">${record.detail}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-bold ${
              record.mode === 'target' ? 'text-cyan-200' : 'text-emerald-200'
            }">${record.scoreLabel}</p>
            <p class="mt-0.5 text-[11px] text-slate-500">${record.createdAt}</p>
          </div>
        </article>
      `,
    )
    .join('')
}

function showResult(result: GameResult): void {
  const copy = buildResultCopy(result)
  audio.play(result.tone === 'miss' || result.tone === 'caught' ? 'fail' : 'win')

  elements.resultIcon.dataset.tone = result.tone
  elements.resultIcon.innerHTML = `<i data-lucide="${copy.icon}" class="size-8"></i>`
  elements.resultKicker.textContent = modeLabel(result.mode)
  elements.resultTitle.textContent = copy.title
  elements.resultCopy.textContent = copy.body
  elements.resultStats.innerHTML = copy.stats
    .map(
      ([label, value]) => `
        <div class="result-stat">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join('')
  elements.modal.classList.remove('hidden')
  renderStaticIcons()
}

function buildResultCopy(result: GameResult): {
  icon: string
  title: string
  body: string
  stats: [string, string][]
} {
  if (result.mode === 'target') {
    const title =
      result.tone === 'elite'
        ? '정밀한 정지'
        : result.tone === 'good'
          ? '좋은 타이밍'
          : '다음 판에서 보정'

    return {
      icon: result.tone === 'elite' ? 'crown' : result.tone === 'good' ? 'thumbs-up' : 'radar',
      title,
      body: `목표와 실제 정지 사이의 오차는 ${formatSeconds(result.diffSeconds)}입니다.`,
      stats: [
        ['목표', formatSeconds(result.targetSeconds)],
        ['정지', formatSeconds(result.stoppedSeconds)],
        ['오차', formatSeconds(result.diffSeconds)],
        ['점수', `${result.score}점`],
      ],
    }
  }

  return {
    icon: result.survived ? 'shield-check' : 'octagon-alert',
    title: result.survived ? '생존 성공' : '움직임 감지',
    body: result.survived
      ? '신호 전환을 끝까지 버텼습니다.'
      : 'FREEZE 구간에서 포인터 움직임이 감지되었습니다.',
    stats: [
      ['목표', formatSeconds(result.durationSeconds)],
      ['버틴 시간', formatSeconds(result.elapsedSeconds)],
      ['점수', `${result.score}점`],
    ],
  }
}

function queueSignalFlip(): void {
  clearSignalTimer()

  signalTimer = window.setTimeout(() => {
    if (state.phase !== 'playing' || state.mode !== 'redlight') return
    state.redLightSignal = nextSignal(state.redLightSignal)
    state.redLightSignalChangedAt = performance.now()
    audio.play('switch')
    queueSignalFlip()
  }, pickSignalDelayMs())
}

function clearTimers(): void {
  clearCountdown()
  clearSignalTimer()
}

function clearCountdown(): void {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function clearSignalTimer(): void {
  if (signalTimer !== null) {
    window.clearTimeout(signalTimer)
    signalTimer = null
  }
}

function renderStaticIcons(): void {
  createIcons({
    icons: {
      CircleStop,
      Crown,
      MousePointer2,
      OctagonAlert,
      Play,
      Radar,
      RotateCcw,
      ShieldCheck,
      ThumbsUp,
      Timer,
      TrafficCone,
      Trophy,
    },
  })
}

window.addEventListener('beforeunload', () => {
  window.cancelAnimationFrame(frameId)
  clearTimers()
})
