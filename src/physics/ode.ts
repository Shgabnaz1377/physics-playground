/**
 * Classic fourth-order Runge-Kutta for autonomous systems y' = f(y).
 * Buffers are preallocated so the integrator does not allocate per step.
 */

export type Derivative = (y: Float64Array, out: Float64Array) => void

export class RK4 {
  private readonly k1: Float64Array
  private readonly k2: Float64Array
  private readonly k3: Float64Array
  private readonly k4: Float64Array
  private readonly tmp: Float64Array

  constructor(
    readonly dim: number,
    private readonly f: Derivative,
  ) {
    this.k1 = new Float64Array(dim)
    this.k2 = new Float64Array(dim)
    this.k3 = new Float64Array(dim)
    this.k4 = new Float64Array(dim)
    this.tmp = new Float64Array(dim)
  }

  /** Advance y in place by one step of size h. */
  step(y: Float64Array, h: number): void {
    const { k1, k2, k3, k4, tmp, f, dim } = this
    f(y, k1)
    for (let i = 0; i < dim; i++) tmp[i] = y[i]! + 0.5 * h * k1[i]!
    f(tmp, k2)
    for (let i = 0; i < dim; i++) tmp[i] = y[i]! + 0.5 * h * k2[i]!
    f(tmp, k3)
    for (let i = 0; i < dim; i++) tmp[i] = y[i]! + h * k3[i]!
    f(tmp, k4)
    for (let i = 0; i < dim; i++) {
      y[i] = y[i]! + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!)
    }
  }
}
