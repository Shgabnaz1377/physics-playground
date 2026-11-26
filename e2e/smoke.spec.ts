import { expect, test, type Page } from '@playwright/test'

const SIMS = ['wave', 'double-pendulum', 'ising', 'heat', 'lennard-jones', 'optimizers', 'fourier']

/** Collect console errors/warnings and uncaught exceptions for the lifetime of the page. */
function watchConsole(page: Page): string[] {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  return problems
}

test('gallery lists every simulation with a live thumbnail', async ({ page }) => {
  const problems = watchConsole(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Physics Playground' })).toBeVisible()
  const cards = page.getByRole('list', { name: 'Simulations' }).getByRole('link')
  await expect(cards).toHaveCount(SIMS.length)
  await expect(page.locator('canvas.thumb')).toHaveCount(SIMS.length)
  await page.waitForTimeout(500)
  expect(problems).toEqual([])
})

for (const slug of SIMS) {
  test(`${slug}: renders, animates and logs nothing to the console`, async ({ page }) => {
    const problems = watchConsole(page)
    await page.goto(`/sim/${slug}`)
    await expect(page.locator('canvas.main')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The physics' })).toBeVisible()
    // KaTeX rendered the equations.
    await expect(page.locator('.katex').first()).toBeVisible()
    // The animation loop is running and reporting a frame rate.
    await expect(page.locator('.fps')).toHaveText(/\d+ fps/, { timeout: 5000 })
    expect(problems).toEqual([])
  })
}

test('Space toggles play/pause and R resets', async ({ page }) => {
  await page.goto('/sim/double-pendulum')
  const toggle = page.getByRole('toolbar', { name: 'Simulation controls' }).getByRole('button').first()
  await expect(toggle).toHaveText(/Pause/)
  await page.locator('body').press('Space')
  await expect(toggle).toHaveText(/Play/)
  await expect(page.locator('.fps')).toHaveText('paused')
  await page.locator('body').press('Space')
  await expect(toggle).toHaveText(/Pause/)

  await page.goto('/sim/double-pendulum?theta1=45')
  await page.locator('body').press('r')
  await expect(page).toHaveURL(/\/sim\/double-pendulum$/)
})

test('slider changes are written to the URL and restored from it', async ({ page }) => {
  await page.goto('/sim/ising')
  const slider = page.getByLabel('Temperature T')
  await slider.focus()
  await slider.press('ArrowLeft')
  await slider.press('ArrowLeft')
  await expect(page).toHaveURL(/[?&]T=2\.25(&|$)/)

  await page.goto('/sim/ising?T=1.5&size=64')
  await expect(page.getByLabel('Temperature T')).toHaveValue('1.5')
  await expect(page.getByLabel('Lattice size')).toHaveValue('64')
})

test('out-of-range URL values are clamped, not trusted', async ({ page }) => {
  await page.goto('/sim/wave?courant=5&wavelength=abc')
  await expect(page.getByLabel('Courant number C = cΔt/Δx')).toHaveValue('0.7')
  await expect(page.getByLabel('Wavelength λ')).toHaveValue('14')
})

test('theme toggle switches and persists', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')
  const before = await html.getAttribute('data-theme')
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click()
  const after = await html.getAttribute('data-theme')
  expect(after).not.toBe(before)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', after!)
})

test('unknown routes show the not-found page', async ({ page }) => {
  await page.goto('/sim/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Nothing here' })).toBeVisible()
})
