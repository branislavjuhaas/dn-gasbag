/**
 * A monotonic frame clock for a game loop.
 *
 * Time comes from `performance.now()` and every delta is clamped, so a long
 * stall (laptop sleep, debugger pause, Ctrl+Z) cannot teleport entities across
 * the map. Create one clock per game and call {@link tick} exactly once per
 * frame, or let {@link startLoop} drive it.
 *
 * @example
 * ```ts
 * const clock = new Clock();
 *
 * function frame() {
 *   const dt = clock.tick();
 *   update(dt);
 *   draw();
 * }
 * ```
 */
export class Clock {
  /** Seconds between the previous two ticks, clamped to {@link maxDt}. */
  dt = 0;

  /** Total game time in seconds, accumulated from clamped deltas. */
  elapsed = 0;

  /** Number of timed ticks so far; the first call to {@link tick} is not counted. */
  frame = 0;

  /** Smoothed frames per second, for a debug overlay. */
  fps = 0;

  /** Timestamp of the previous tick, or `null` before the first one. */
  private last: number | null = null;

  /**
   * @param maxDt - Upper bound applied to every delta, in seconds. Defaults to
   * 100 ms, which is generous for a normal frame yet stops a long stall from
   * being simulated in a single step.
   */
  constructor(public maxDt = 0.1) {}

  /**
   * Advances the clock. Call once per frame.
   *
   * The first call only records the start time and returns `0`. Afterwards the
   * returned value is the time since the previous call, capped at
   * {@link maxDt}. {@link dt}, {@link elapsed}, {@link frame} and {@link fps}
   * are updated as side effects.
   *
   * {@link fps} is smoothed from the raw, unclamped interval, so a stall shows
   * up as a dip in the overlay instead of being hidden by the clamp.
   *
   * @returns Delta time in seconds; `0` on the first call.
   */
  tick(): number {
    const now = performance.now();
    if (this.last === null) {
      this.last = now;
      return 0;
    }
    const raw = (now - this.last) / 1000;
    this.last = now;

    this.dt = Math.min(raw, this.maxDt);
    this.elapsed += this.dt;
    this.frame++;
    if (raw > 0) {
      const inst = 1 / raw;
      this.fps = this.fps === 0 ? inst : this.fps + (inst - this.fps) * 0.1;
    }
    return this.dt;
  }
}

/**
 * Runs `frame(dt)` at roughly `fps` frames per second and returns a function
 * that stops the loop.
 *
 * Frames are scheduled with `setTimeout` against absolute target times
 * (`next += interval`), so timer jitter does not accumulate. When a frame runs
 * long, the loop resynchronizes to the current time instead of firing a burst
 * of catch-up frames.
 *
 * The first frame runs synchronously and receives `dt === 0`, which makes it
 * safe to use for setup and for the initial draw.
 *
 * @param frame - Called once per tick with the clamped delta time in seconds.
 * @param fps - Target frame rate. Defaults to `60`.
 * @param maxDt - Delta clamp for the internal {@link Clock}, in seconds.
 * Defaults to `0.1`.
 * @returns Stops the loop when called; safe to call more than once.
 *
 * @example
 * ```ts
 * const stop = startLoop((dt) => {
 *   update(dt);
 *   process.stdout.write(screen.render());
 * });
 *
 * process.on("SIGINT", () => {
 *   stop();
 *   process.stdout.write(LEAVE);
 *   process.exit(0);
 * });
 * ```
 */
export function startLoop(frame: (dt: number) => void, fps = 60, maxDt = 0.1): () => void {
  const clock = new Clock(maxDt);
  const interval = 1000 / fps;
  let next = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = true;

  const step = () => {
    if (!running) return;
    frame(clock.tick());
    const now = performance.now();
    next += interval;
    if (next < now) next = now; // fell behind: resync instead of bursting
    timer = setTimeout(step, next - now);
  };
  step();

  return () => {
    running = false;
    clearTimeout(timer);
  };
}
