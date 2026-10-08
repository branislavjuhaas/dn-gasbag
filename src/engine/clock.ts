export class Clock {
  /** Seconds between the last two ticks, clamped to maxDt. */
  dt = 0
  /** Total clamped game time in seconds. */
  elapsed = 0
  /** Number of ticks so far. */
  frame = 0
  /** Smoothed frames per second (for a debug overlay). */
  fps = 0

  private last: number | null = null

  /** maxDt stops a long stall (laptop sleep, Ctrl+Z, debugger pause) from teleporting entities. */
  constructor(public maxDt = 0.1) {
  }

  /** Call once per frame. Returns delta time in seconds (0 on the first call). */
  tick(): number {
    const now = performance.now()
    if (this.last === null) {
      this.last = now
      return 0
    }
    const raw = (now - this.last) / 1000
    this.last = now

    this.dt = Math.min(raw, this.maxDt)
    this.elapsed += this.dt
    this.frame++
    if (raw > 0) {
      const inst = 1 / raw
      this.fps = this.fps === 0 ? inst : this.fps + (inst - this.fps) * 0.1
    }
    return this.dt
  }
}

/**
 * Run `frame(dt)` at roughly `fps` frames per second. Returns a function that stops the loop.
 * Frames are scheduled against absolute target times, so timer jitter doesn't accumulate.
 * If a frame runs long, the loop doesn't try to catch up by running extra frames.
 */
export function startLoop(frame: (dt: number) => void, fps = 60, maxDt = 0.1): () => void {
  const clock = new Clock(maxDt)
  const interval = 1000 / fps
  let next = performance.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = true

  const step = () => {
    if (!running) return
    frame(clock.tick())
    const now = performance.now()
    next += interval
    if (next < now) next = now // fell behind: resync instead of bursting
    timer = setTimeout(step, next - now)
  }
  step()

  return () => {
    running = false
    clearTimeout(timer)
  }
}