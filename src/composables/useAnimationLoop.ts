import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

export interface LoopCallbacks {
  /** Advance the simulation by dt seconds of wall time (only while running). */
  step?: (dt: number) => void
  /** Render the current state. Called every running frame, or once after invalidate(). */
  draw: () => void
}

/**
 * requestAnimationFrame loop that steps a simulation while `running` is true
 * and otherwise only redraws on demand, so a paused simulation costs nothing.
 */
export function useAnimationLoop(running: Ref<boolean>, cb: LoopCallbacks) {
  const fps = ref(0)
  let raf = 0
  let last = 0
  let dirty = true
  let frames = 0
  let fpsWindowStart = 0

  function frame(now: number) {
    raf = 0
    if (running.value) {
      // Clamp dt so a backgrounded tab does not produce one enormous step.
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60
      last = now
      cb.step?.(dt)
      cb.draw()
      frames++
      if (now - fpsWindowStart >= 500) {
        fps.value = Math.round((frames * 1000) / (now - fpsWindowStart))
        frames = 0
        fpsWindowStart = now
      }
      schedule()
    } else {
      last = 0
      if (dirty) cb.draw()
    }
    dirty = false
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(frame)
  }

  /** Request a redraw on the next frame, e.g. after a parameter change while paused. */
  function invalidate() {
    dirty = true
    schedule()
  }

  watch(running, (r) => {
    frames = 0
    fpsWindowStart = performance.now()
    if (!r) fps.value = 0
    schedule()
  })

  onMounted(() => {
    fpsWindowStart = performance.now()
    invalidate()
  })

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  })

  return { fps, invalidate }
}
