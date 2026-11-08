import type { Page } from '@playwright/test'

/** Open the app with the welcome tour already done. */
export async function openApp(page: Page, path = '/') {
  await page.goto(path)
  const skip = page.getByRole('button', { name: 'Skip', exact: true })
  await skip.waitFor({ state: 'visible', timeout: 5000 }).then(() => skip.click()).catch(() => {})
  await page.locator('.z-\\[90\\]').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
}

export const count = (page: Page, table: string) =>
  page.evaluate(
    (t) =>
      new Promise<number>((res) => {
        const r = indexedDB.open('cozy-planner')
        r.onsuccess = () => {
          const q = r.result.transaction(t).objectStore(t).getAll()
          q.onsuccess = () => res((q.result as { deleted?: boolean }[]).filter((x) => !x.deleted).length)
        }
      }),
    table,
  )
