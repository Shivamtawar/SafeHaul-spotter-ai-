import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { chooseTrip, mockApi, planTrip } from './mocks.ts'

test.describe('planning a trip', () => {
  test('compares three routes and shows them on the map', async ({ page }) => {
    await mockApi(page)
    await page.goto('/plan')
    await expect(page.getByText(/Enter a trip to compare up to three truck routes/)).toBeVisible()

    await planTrip(page)

    await expect(page.getByRole('button', { name: /Route 1/ })).toContainText('Recommended')
    await expect(page.getByRole('button', { name: /Route 2/ })).toContainText('No Travel')
    await expect(page.locator('.leaflet-container')).toBeVisible()
    await expect(page.locator('canvas.leaflet-risk-layer')).toHaveCount(1)
    await expect(page.getByText('Route 1 checkpoints (')).toBeVisible()
  })

  test('scrubbing the forecast makes no further requests', async ({ page }) => {
    const api = await mockApi(page)
    await page.goto('/plan')
    await planTrip(page)
    const before = api.planRequests()

    const slider = page.getByRole('slider', { name: /forecast/i })
    await slider.fill('30')
    await expect(slider).toHaveAttribute('aria-valuetext', /\+30 h/)
    await page.getByRole('button', { name: 'Play forecast animation' }).click()
    await expect(page.getByRole('button', { name: 'Pause forecast animation' })).toBeVisible()
    await page.getByRole('button', { name: 'Pause forecast animation' }).click()
    await page.getByRole('checkbox', { name: 'Heatmap' }).uncheck()
    await expect(page.locator('canvas.leaflet-risk-layer')).toHaveCount(0)

    expect(api.planRequests()).toBe(before)
  })

  test('the forecast slider works from the keyboard', async ({ page }) => {
    await mockApi(page)
    await page.goto('/plan')
    await planTrip(page)

    const slider = page.getByRole('slider', { name: /forecast/i })
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue('2')
    await page.keyboard.press('End')
    await expect(slider).toHaveValue('48')
  })

  test('a No Travel route stays visible and triggers a loud warning', async ({ page }) => {
    await mockApi(page)
    await page.goto('/plan')
    await planTrip(page)
    await expect(page.getByText(/NO TRAVEL on Route/)).toHaveCount(0)

    await page.getByRole('button', { name: /Route 2/ }).click()
    const banner = page.locator('.no-travel-banner')
    await expect(banner).toContainText('NO TRAVEL on Route 2')
    await expect(banner).toContainText('Do not dispatch')
    await expect(page.getByRole('button', { name: /Route 2/ })).toContainText(
      'NO TRAVEL - DO NOT DISPATCH',
    )

    await banner.getByRole('button', { name: 'Show the recommended route' }).click()
    await expect(banner).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Route 1/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('the keyboard-accessible table lists every checkpoint', async ({ page }) => {
    await mockApi(page)
    await page.goto('/plan')
    await planTrip(page)
    await page.getByText('Route 1 checkpoints (').click()
    const rows = page.getByRole('table').getByRole('row')
    expect(await rows.count()).toBeGreaterThan(3)
  })
})

test.describe('when things go wrong', () => {
  test('shows the server message and recovers with Try again', async ({ page }) => {
    const api = await mockApi(page, {
      failFirst: 1,
      planError: { status: 502, code: 'upstream_unavailable', message: 'Weather service is down.' },
    })
    await page.goto('/plan')
    await chooseTrip(page)
    await page.getByRole('button', { name: /find the safest route/i }).click()

    await expect(
      page.getByRole('alert').filter({ hasText: 'Weather service is down.' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { name: '3 routes, safest first' })).toBeVisible()
    expect(api.planRequests()).toBe(2)
  })

  test('asks for both places before calling the server', async ({ page }) => {
    const api = await mockApi(page)
    await page.goto('/plan')
    await page.getByRole('button', { name: /find the safest route/i }).click()
    await expect(page.getByText('Choose a starting place from the list.')).toBeVisible()
    await expect(page.getByText('Choose a destination from the list.')).toBeVisible()
    expect(api.planRequests()).toBe(0)
  })
})

test.describe('accessibility', () => {
  async function scan(page: import('@playwright/test').Page) {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)
  }

  test('the start screen has no violations', async ({ page }) => {
    await mockApi(page)
    await page.goto('/plan')
    await page.locator('.leaflet-container').waitFor()
    expect(await scan(page)).toEqual([])
  })

  test('the results screen has no violations', async ({ page }) => {
    await mockApi(page)
    await page.goto('/plan')
    await planTrip(page)
    await page.getByRole('button', { name: /Route 2/ }).click()
    expect(await scan(page)).toEqual([])
  })

  test('the error state has no violations', async ({ page }) => {
    await mockApi(page, {
      planError: { status: 404, code: 'no_route_found', message: 'No truck route could be found.' },
    })
    await page.goto('/plan')
    await chooseTrip(page)
    await page.getByRole('button', { name: /find the safest route/i }).click()
    await page.getByRole('alert').filter({ hasText: 'No truck route' }).waitFor()
    expect(await scan(page)).toEqual([])
  })
})
