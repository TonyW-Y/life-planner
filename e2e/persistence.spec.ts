import { expect, test } from '@playwright/test'
import { count, openApp } from './helpers'

test('a new to-do survives closing and reopening the app', async ({ page }) => {
  await openApp(page, '/tasks')
  await page.getByLabel('Quick add').fill('Finish renal notes tomorrow !must')
  await page.getByLabel('Quick add').press('Enter')
  await expect(page.getByText('Finish renal notes').first()).toBeVisible()
  await page.reload()
  await expect(page.getByText('Finish renal notes').first()).toBeVisible()
})

test('half-typed text is kept when the app is closed mid-sentence', async ({ page, context }) => {
  await openApp(page, '/tasks')
  await page.getByLabel('Quick add').fill('Email the clerkship coordi')
  // simulate leaving the app right away
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(400)
  const again = await context.newPage()
  await again.goto('/tasks')
  await expect(again.getByLabel('Quick add')).toHaveValue('Email the clerkship coordi')
})

test('half-typed TT message is kept too', async ({ page }) => {
  await openApp(page, '/tt')
  await page.getByLabel('Message TT').fill('today was a lot because')
  await page.waitForTimeout(400)
  await page.reload()
  await expect(page.getByLabel('Message TT')).toHaveValue('today was a lot because')
})

test('timer keeps the right time across a reload', async ({ page }) => {
  await openApp(page, '/study/timer')
  await page.getByRole('button', { name: /Start/ }).click()
  await page.waitForTimeout(2500)
  await page.reload()
  const clock = page.locator('[aria-live="polite"]')
  await expect(clock).toHaveText(/24:5\d|24:4\d/)
  await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible()
})

test('delete then undo brings it back', async ({ page }) => {
  await openApp(page, '/tasks')
  await page.getByLabel('Quick add').fill('Buy scrubs')
  await page.getByLabel('Quick add').press('Enter')
  await page.getByText('Buy scrubs').first().click()
  await page.getByRole('button', { name: /Delete/ }).click()
  await expect.poll(() => count(page, 'tasks')).toBe(0)
  await page.getByRole('button', { name: 'Undo' }).first().click()
  await expect.poll(() => count(page, 'tasks')).toBe(1)
})
