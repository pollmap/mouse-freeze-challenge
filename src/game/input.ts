import type { PointerSnapshot, PointerStatus } from './types'

const MOVING_WINDOW_MS = 110
const MOVEMENT_THRESHOLD_PX = 1.2

export class PointerTracker {
  private readonly arena: HTMLElement
  private inArena = false
  private lastMoveAt = 0
  private lastX = 0
  private lastY = 0

  constructor(arena: HTMLElement) {
    this.arena = arena
    this.bind()
  }

  getSnapshot(now = performance.now()): PointerSnapshot {
    return {
      inArena: this.inArena,
      moving: this.inArena && now - this.lastMoveAt < MOVING_WINDOW_MS,
      idleForMs: this.inArena ? Math.max(0, now - this.lastMoveAt) : 0,
      x: this.lastX,
      y: this.lastY,
    }
  }

  getStatus(now = performance.now()): PointerStatus {
    const snapshot = this.getSnapshot(now)
    if (!snapshot.inArena) return 'outside'
    return snapshot.moving ? 'moving' : 'frozen'
  }

  private bind(): void {
    this.arena.addEventListener('pointerenter', this.handleEnter)
    this.arena.addEventListener('pointerleave', this.handleLeave)
    this.arena.addEventListener('pointerdown', this.handleMove)
    this.arena.addEventListener('pointermove', this.handleMove)
  }

  private handleEnter = (event: PointerEvent): void => {
    this.inArena = true
    this.lastX = event.clientX
    this.lastY = event.clientY
    this.lastMoveAt = performance.now()
  }

  private handleLeave = (): void => {
    this.inArena = false
  }

  private handleMove = (event: PointerEvent): void => {
    const distance = Math.hypot(event.clientX - this.lastX, event.clientY - this.lastY)

    this.inArena = true
    this.lastX = event.clientX
    this.lastY = event.clientY

    if (distance >= MOVEMENT_THRESHOLD_PX || event.type === 'pointerdown') {
      this.lastMoveAt = performance.now()
      this.spawnTrail(event.clientX, event.clientY)
    }
  }

  private spawnTrail(x: number, y: number): void {
    if (!this.inArena) return

    const dot = document.createElement('span')
    dot.className = 'trail-dot'
    dot.style.left = `${x}px`
    dot.style.top = `${y}px`
    document.body.appendChild(dot)

    window.setTimeout(() => {
      dot.classList.add('trail-dot--fade')
    }, 16)

    window.setTimeout(() => {
      dot.remove()
    }, 360)
  }
}
