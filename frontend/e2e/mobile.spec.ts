import { expect, test } from '@playwright/test'
import { mockApi, planTrip } from './mocks.ts'

test('on a phone the form comes first, then the map pins above the results', async ({ page }) => {
  await mockApi(page)
  await page.goto('/plan')

  const form = page.getByRole('combobox', { name: 'From' })
  const map = page.locator('.map-area')
  expect((await form.boundingBox())!.y).toBeLessThan((await map.boundingBox())!.y)

  await planTrip(page)
  const results = page.getByRole('heading', { name: '3 routes, safest first' })
  expect((await map.boundingBox())!.y).toBeLessThan((await results.boundingBox())!.y)

  // The map stays pinned while the results scroll beneath it.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  expect((await map.boundingBox())!.y).toBeLessThanOrEqual(1)
})

test('nothing overflows sideways and controls are comfortably tappable', async ({ page }) => {
  await mockApi(page)
  await page.goto('/plan')
  await planTrip(page)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  for (const control of [
    page.getByRole('combobox', { name: 'From' }),
    page.getByRole('button', { name: /find the safest route/i }),
    page.locator('.segment', { hasText: '25 mi' }),
  ]) {
    const box = await control.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
})

test('the forecast slider and warnings fit on a phone', async ({ page }) => {
  await mockApi(page)
  await page.goto('/plan')
  await planTrip(page)
  await page.getByRole('button', { name: /Route 2/ }).click()

  const viewport = page.viewportSize()!
  for (const selector of ['.time-slider', '.no-travel-banner']) {
    const box = (await page.locator(selector).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  }
})

test.describe('landing page on a phone', () => {
  test('fits the screen with the call to action in view', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    const viewport = page.viewportSize()!
    const cta = page.getByRole('link', { name: 'Plan a route' }).first()
    await expect(cta).toBeInViewport()
    const box = (await cta.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  })

  test('every section stays inside the screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const width = page.viewportSize()!.width
    for (const selector of [
      '.hero-map',
      '.demo-card',
      '.risk-table',
      '.timeline',
      '.faq-list',
      '.cta-band',
    ]) {
      const box = (await page.locator(selector).first().boundingBox())!
      expect(box.x, selector).toBeGreaterThanOrEqual(-1)
      expect(box.x + box.width, selector).toBeLessThanOrEqual(width + 1)
    }
  })

  test('a popular trip is one tap from the planner', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await page.getByRole('link', { name: /Dallas → Denver/ }).tap()
    await expect(page.getByRole('combobox', { name: 'From' })).toHaveValue('Dallas, TX, USA')
  })
})
