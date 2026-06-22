export class GameAudio {
  private context: AudioContext | null = null

  enable(): void {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) return

    this.context ??= new AudioContextCtor()
    if (this.context.state === 'suspended') {
      void this.context.resume()
    }
  }

  play(type: 'beep' | 'start' | 'switch' | 'win' | 'fail'): void {
    if (!this.context) return

    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.connect(gain)
    gain.connect(this.context.destination)

    const now = this.context.currentTime
    let stopAt = now + 0.1

    if (type === 'beep') {
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(620, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
      stopAt = now + 0.1
    }

    if (type === 'start') {
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(360, now)
      oscillator.frequency.exponentialRampToValueAtTime(840, now + 0.22)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.26)
      stopAt = now + 0.26
    }

    if (type === 'switch') {
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(260, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
      stopAt = now + 0.12
    }

    if (type === 'win') {
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(520, now)
      oscillator.frequency.exponentialRampToValueAtTime(1040, now + 0.34)
      gain.gain.setValueAtTime(0.14, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
      stopAt = now + 0.4
    }

    if (type === 'fail') {
      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(180, now)
      oscillator.frequency.linearRampToValueAtTime(80, now + 0.42)
      gain.gain.setValueAtTime(0.14, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.48)
      stopAt = now + 0.48
    }

    oscillator.start(now)
    oscillator.stop(stopAt)
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
