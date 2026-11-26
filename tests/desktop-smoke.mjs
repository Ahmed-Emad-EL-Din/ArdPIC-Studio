import { _electron as electron, expect } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Test-only Linux host for the exact packaged renderer and native IPC files.
// Physical operations are never run, and the shipping launcher keeps its sandbox.
const userDir = await mkdtemp(join(tmpdir(), 'ardpic-electron-smoke-'))
const application = await electron.launch({
  executablePath: resolve('.research/runtime/linux/electron'),
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${userDir}`, resolve('.research/desktop-smoke-app')],
  timeout: 30000,
})
try {
  const page = await application.firstWindow()
  await expect(page.getByRole('heading', { level: 1, name: 'Programmer', exact: true })).toBeVisible()
  const isolated = await page.evaluate(() => typeof window.require === 'undefined' && typeof window.process === 'undefined' && typeof window.ardpic?.ports === 'function')
  if (!isolated) throw new Error('Renderer process isolation is incorrect.')
  const probe = await page.evaluate(async () => { try { await window.ardpic.ports(); return '' } catch (e) { return e.message } })
  if (!probe.includes('requires Windows x64')) throw new Error('Expected native adapter did not receive the trusted renderer request: ' + probe)
  const report = await page.evaluate(() => window.ardpic.setupCheck())
  if (report.ready !== false || !report.items.some(i => i.id === 'platform' && i.status === 'error')) throw new Error('System check did not report the non-Windows host.')
  if (!report.items.some(i => i.id.startsWith('tool:') && i.status === 'ok')) throw new Error('Bundled tools were not verified.')
  await page.getByRole('button', { name: 'Connect programmer', exact: true }).click()
  await page.getByRole('button', { name: 'Simulation', exact: true }).click()
  await page.getByRole('button', { name: 'Connect virtual programmer', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Load example HEX' }).click()
  await page.getByRole('button', { name: 'Program target', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Program virtual target', exact: true }).click()
  await expect(page.getByText('Written and verified', { exact: true })).toBeVisible()
  console.log('PASS: packaged offline renderer starts in Electron, Node is isolated, IPC origin checks accept the local workbench, the non-Windows adapter fails closed, and virtual readback passes.')
} finally {
  await application.close()
  await rm(userDir, { recursive: true, force: true })
}