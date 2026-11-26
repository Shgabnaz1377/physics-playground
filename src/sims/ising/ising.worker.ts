import { IsingLattice } from '@/physics/ising'
import type { FromWorker, ToWorker } from './protocol'

/**
 * Runs Metropolis sweeps off the main thread. The page requests a batch of
 * sweeps per animation frame and receives a copy of the spins back, so the UI
 * never blocks even for a 256 x 256 lattice at many sweeps per frame.
 */

interface WorkerScope {
  postMessage(message: FromWorker, transfer: Transferable[]): void
  onmessage: ((ev: MessageEvent<ToWorker>) => void) | null
}

const scope = self as unknown as WorkerScope
let lat: IsingLattice | null = null
let scanQueue: number[] = []
let scanEquil = 0
let scanMeasure = 0

function post(msg: FromWorker, transfer: Transferable[] = []) {
  scope.postMessage(msg, transfer)
}

function sendFrame() {
  if (!lat) return
  const spins = lat.spins.slice()
  post({ type: 'frame', spins, e: lat.e(), m: lat.m(), sweeps: lat.sweeps, T: lat.temperature }, [spins.buffer])
}

/** Measure one temperature of a scan, then yield so cancel/other messages can arrive. */
function scanNext() {
  if (!lat) return
  const T = scanQueue.shift()
  if (T === undefined) {
    post({ type: 'scan-done' })
    return
  }
  lat.setParams(T, 0)
  for (let i = 0; i < scanEquil; i++) lat.sweep()
  let sm = 0
  let sm2 = 0
  let se = 0
  let se2 = 0
  for (let i = 0; i < scanMeasure; i++) {
    lat.sweep()
    const m = Math.abs(lat.m())
    const e = lat.e()
    sm += m
    sm2 += m * m
    se += e
    se2 += e * e
  }
  const n = scanMeasure
  const N = lat.N
  const absM = sm / n
  const e = se / n
  // Fluctuation-dissipation: chi = N (<m^2> - <|m|>^2) / T,  C = N (<e^2> - <e>^2) / T^2
  const chi = (N * (sm2 / n - absM * absM)) / T
  const cv = (N * (se2 / n - e * e)) / (T * T)
  post({ type: 'scan-point', T, absM, e, chi, cv })
  sendFrame()
  setTimeout(scanNext, 0)
}

scope.onmessage = (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data
  switch (msg.type) {
    case 'init':
      lat = new IsingLattice(msg.L, msg.seed, msg.start)
      lat.setParams(msg.T, msg.h)
      scanQueue = []
      sendFrame()
      break
    case 'params':
      lat?.setParams(msg.T, msg.h)
      break
    case 'run':
      if (!lat || scanQueue.length) break
      for (let i = 0; i < msg.sweeps; i++) lat.sweep()
      sendFrame()
      break
    case 'scan':
      scanQueue = [...msg.temperatures]
      scanEquil = msg.equilibrate
      scanMeasure = msg.measure
      setTimeout(scanNext, 0)
      break
    case 'cancel-scan':
      scanQueue = []
      break
  }
}
