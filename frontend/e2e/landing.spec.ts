import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { mockApi } from './mocks.ts'

test.describe('landing page', () => {
  test('introduces the product and leads to the planner', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SafeHaul/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Arrive safe.')

    await page.getByRole('link', { name: 'Plan a route' }).first().click()
    await expect(page).toHaveURL(/\/plan$/)
    await expect(page.getByRole('heading', { name: 'Plan your trip' })).toBeVisible()
  })

  test('a popular trip opens the planner already filled in, and plans', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')
    await page.getByRole('link', { name: /Dallas → Denver/ }).click()

    await expect(page).toHaveURL(/trip=dallas-denver/)
    await expect(page.getByRole('combobox', { name: 'From' })).toHaveValue('Dallas, TX, USA')
    await expect(page.getByRole('combobox', { name: 'To' })).toHaveValue('Denver, CO, USA')

    await page.getByRole('button', { name: /find the safest route/i }).click()
    await expect(page.getByRole('heading', { name: '3 routes, safest first' })).toBeVisible()
  })

  test('the navigation shrinks on scroll and jumps to sections', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('.site-nav')
    await expect(nav).toHaveAttribute('data-scrolled', 'false')

    await page.getByRole('link', { name: 'FAQ', exact: true }).first().click()
    await expect(page.locator('#faq')).toBeInViewport()
    await expect(nav).toHaveAttribute('data-scrolled', 'true')
  })

  test('shows every risk threshold from the brief', async ({ page }) => {
    await page.goto('/')
    const wind = page.locator('.risk-row', { hasText: 'Wind' })
    await wind.scrollIntoViewIfNeeded()
    for (const range of ['< 25', '25–34', '35–44', '45–54', '≥ 55']) {
      await expect(wind.getByText(range, { exact: true })).toBeVisible()
    }
    await expect(page.getByText('Wind 45–54 mph and over 30,000 lb')).toBeVisible()
    await expect(page.getByText('Fewest Severe miles')).toBeVisible()
  })

  test('FAQ answers open and close', async ({ page }) => {
    await page.goto('/')
    const question = page.getByText('What does No Travel mean?')
    await question.scrollIntoViewIfNeeded()
    const answer = page.getByText(/ranked last and never recommended/)
    await expect(answer).toBeHidden()
    await question.click()
    await expect(answer).toBeVisible()
    await question.click()
    await expect(answer).toBeHidden()
  })

  test('the forecast example can be paused', async ({ page }) => {
    await page.goto('/')
    const readout = page.getByTestId('demo-readout')
    await readout.scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Pause the example' }).click()
    const frozen = await readout.textContent()
    await page.waitForTimeout(900)
    expect(await readout.textContent()).toBe(frozen)
    await expect(page.getByRole('button', { name: 'Play the example' })).toBeVisible()
  })

  test('unknown pages offer a way home', async ({ page }) => {
    await page.goto('/definitely-not-a-page')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await page.getByRole('link', { name: 'Back to SafeHaul' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('has no accessibility violations', async ({ page }) => {
    // Reduced motion shows everything at once, so the scan sees the whole page.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.locator('footer').scrollIntoViewIfNeeded()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([])
  })
})
