/**
 * Capture the README screenshots and GIFs from the running app.
 *
 *   npm run build && npm run capture            # everything
 *   npm run capture -- fourier ising             # only files whose name contains a filter
 *
 * Starts `vite preview`, drives each page with Playwright and writes PNG/GIF
 * files to docs/media/. Everything shown in the README comes from this script,
 * so the images always match the code.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium, type Locator, type Page } from '@playwright/test'
import gifenc from 'gifenc'
import { PNG } from 'pngjs'

const PORT = 4191
const BASE = `http://localhost:${PORT}`
const OUT = 'docs/media'

interface Still {
  file: string
  path: string
  theme: 'light' | 'dark'
  /** Seconds to let the simulation run before capturing. */
  wait: number
  /** Optional interaction before waiting. */
  before?: (page: Page) => Promise<void>
  /** Capture the whole page instead of the simulation body. */
  page?: boolean
}

interface Clip {
  file: string
  path: string
  theme: 'light' | 'dark'
  warmup: number
  frames: number
  intervalMs: number
  width: number
}

const stills: Still[] = [
  { file: 'gallery-dark.png', path: '/', theme: 'dark', wait: 2.5, page: true },
  { file: 'gallery-light.png', path: '/', theme: 'light', wait: 2.5, page: true },
  { file: 'wave.png', path: '/sim/wave?speed=8', theme: 'dark', wait: 9 },
  { file: 'wave-intensity.png', path: '/sim/wave?view=intensity&speed=8', theme: 'light', wait: 9 },
  { file: 'double-pendulum.png', path: '/sim/double-pendulum', theme: 'dark', wait: 12 },
  {
    file: 'ising.png',
    path: '/sim/ising',
    theme: 'dark',
    wait: 24,
    before: async (page) => {
      await page.getByRole('button', { name: /Run temperature scan/ }).click()
    },
  },
  { file: 'heat.png', path: '/sim/heat?speed=30', theme: 'light', wait: 8 },
  { file: 'lennard-jones.png', path: '/sim/lennard-jones', theme: 'dark', wait: 10 },
  { file: 'optimizers.png', path: '/sim/optimizers', theme: 'light', wait: 10 },
  { file: 'fourier.png', path: '/sim/fourier?shape=star&terms=40', theme: 'dark', wait: 5.6 },
]

const clips: Clip[] = [
  { file: 'wave.gif', path: '/sim/wave?scene=two-sources&speed=4', theme: 'dark', warmup: 4, frames: 32, intervalMs: 70, width: 320 },
  { file: 'double-pendulum.gif', path: '/sim/double-pendulum', theme: 'dark', warmup: 1, frames: 60, intervalMs: 60, width: 420 },
  { file: 'ising.gif', path: '/sim/ising?T=2.2&start=random&size=128', theme: 'dark', warmup: 0.5, frames: 50, intervalMs: 90, width: 360 },
  { file: 'fourier.gif', path: '/sim/fourier?terms=30&speed=0.4', theme: 'light', warmup: 0.5, frames: 60, intervalMs: 50, width: 420 },
]

async function waitForServer(url: string, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`server at ${url} did not start`)
}

/** Box-filter downscale of an RGBA image by an integer factor. */
function downscale(png: PNG, factor: number): { data: Uint8Array; width: number; height: number } {
  const width = Math.floor(png.width / factor)
  const height = Math.floor(png.height / factor)
  const data = new Uint8Array(width * height * 4)
  const n = factor * factor
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let s = 0
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) s += png.data[((y * factor + dy) * png.width + x * factor + dx) * 4 + c]!
        }
        data[(y * width + x) * 4 + c] = Math.round(s / n)
      }
    }
  }
  return { data, width, height }
}

async function open(page: Page, path: string, theme: 'light' | 'dark') {
  await page.addInitScript((t) => localStorage.setItem('pp-theme', t), theme)
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
}

async function captureStill(page: Page, s: Still) {
  await open(page, s.path, s.theme)
  await s.before?.(page)
  await page.waitForTimeout(s.wait * 1000)
  const target: Page | Locator = s.page ? page : page.locator('.sim .body')
  await target.screenshot({ path: `${OUT}/${s.file}` })
  console.log(`  ${s.file}`)
}

async function captureClip(page: Page, c: Clip) {
  await open(page, c.path, c.theme)
  await page.waitForTimeout(c.warmup * 1000)
  const canvas = page.locator('canvas.main')
  const encoder = gifenc.GIFEncoder()
  for (let i = 0; i < c.frames; i++) {
    const t0 = Date.now()
    const png = PNG.sync.read(await canvas.screenshot())
    const factor = Math.max(1, Math.round(png.width / c.width))
    const frame = downscale(png, factor)
    const palette = gifenc.quantize(frame.data, 256)
    const index = gifenc.applyPalette(frame.data, palette)
    encoder.writeFrame(index, frame.width, frame.height, { palette, delay: c.intervalMs })
    const spent = Date.now() - t0
    if (spent < c.intervalMs) await page.waitForTimeout(c.intervalMs - spent)
  }
  encoder.finish()
  writeFileSync(`${OUT}/${c.file}`, encoder.bytes())
  console.log(`  ${c.file}`)
}

const filters = process.argv.slice(2)
const wanted = (file: string) => !filters.length || filters.some((f) => file.includes(f))

async function main() {
  mkdirSync(OUT, { recursive: true })
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
  })
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1 })
    console.log('stills:')
    for (const s of stills.filter((x) => wanted(x.file))) {
      const page = await context.newPage()
      await captureStill(page, s)
      await page.close()
    }
    console.log('clips:')
    for (const c of clips.filter((x) => wanted(x.file))) {
      const page = await context.newPage()
      await captureClip(page, c)
      await page.close()
    }
    await browser.close()
  } finally {
    server.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
