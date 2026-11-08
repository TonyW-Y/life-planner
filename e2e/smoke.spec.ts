import { expect, test } from '@playwright/test'
import { count, openApp } from './helpers'

test('repeat until a date + switching themes', async ({ page }) => {
  await openApp(page, '/calendar?v=agenda')
  await page.getByLabel('Quick add').fill('Anki 8pm daily until Dec 20')
  await page.getByLabel('Quick add').press('Enter')
  await expect(page.getByText('Anki').first()).toBeVisible()
  await expect.poll(() => count(page, 'events')).toBe(1)

  await page.goto('/settings')
  await page.getByText('Joey Mode').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'joey')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'joey')
})

test('flashcards: import, review, pups cheer', async ({ page }) => {
  await openApp(page, '/study/cards')
  await page.getByText('+ New deck').first().click()
  await page.getByPlaceholder(/Cardio/).fill('Micro')
  await page.getByRole('button', { name: 'Create deck' }).click()
  await page.getByText('Micro').first().click()
  await page.getByRole('button', { name: /Import/ }).first().click()
  await page.locator('textarea').fill('Gram + cocci in clusters\tStaph\nGram + cocci in chains :: Strep')
  await page.getByRole('button', { name: /Import 2 cards/ }).click()
  await page.getByRole('button', { name: /^Study/ }).click()
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /Show answer/ }).click()
    await page.getByRole('button', { name: /^Easy/ }).click()
  }
  await expect(page.getByText('All done!')).toBeVisible()
})

test('TT answers kindly offline and shows help for crisis words', async ({ page }) => {
  await openApp(page, '/tt')
  await page.getByLabel('Message TT').fill('I feel so overwhelmed')
  await page.getByLabel('Message TT').press('Enter')
  await expect(page.locator('text=/breath|plate|ONE|okay/').first()).toBeVisible()
  await page.getByLabel('Message TT').fill('i want to die')
  await page.getByLabel('Message TT').press('Enter')
  await expect(page.getByText('Call 988 — Suicide & Crisis Lifeline')).toBeVisible()
})

test('every page loads without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await openApp(page)
  for (const p of ['/', '/calendar?v=day', '/calendar?v=week', '/calendar?v=month', '/calendar?v=agenda', '/tasks', '/study/timer', '/study/cards', '/study/plan', '/study/stats', '/budget', '/tt', '/settings']) {
    await page.goto(p)
    await page.waitForTimeout(250)
  }
  expect(errors).toEqual([])
})
