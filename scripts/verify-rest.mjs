/**
 * 剩余 3 项的精简验证：音标规范化（实时进度）、搜索、分类浏览。
 * 用法: node scripts/verify-rest.mjs
 */
import { _electron as electron } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const SHOTS = join(ROOT, 'shots')
mkdirSync(SHOTS, { recursive: true })
const consoleErrors = []
const pageErrors = []
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log('=== 启动应用 ===')
  const childEnv = { ...process.env }
  delete childEnv.ELECTRON_RUN_AS_NODE
  delete childEnv.NODE_OPTIONS
  const app = await electron.launch({
    executablePath: join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: ['.'],
    cwd: ROOT,
    env: { ...childEnv, ELECTRON_ENABLE_LOGGING: '1' },
    timeout: 30_000,
  })
  await sleep(6_000)
  const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow()
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('pageerror', err => pageErrors.push(String(err)))
  page.on('dialog', d => d.accept())

  let shotIdx = 0
  async function ss(name) {
    shotIdx++
    const f = join(SHOTS, `${String(shotIdx).padStart(2, '0')}-${name}.png`)
    await page.screenshot({ path: f })
    console.log(`📸 ${f}`)
  }
  async function clickBtn(text) {
    const r = await page.evaluate(t => {
      const el = [...document.querySelectorAll('button')].find(e => e.textContent?.trim().includes(t))
      if (!el) return 'NOT_FOUND'
      el.click()
      return 'OK'
    }, text)
    console.log(`🖱️ 点击「${text}」→ ${r}`)
    await sleep(1_500)
    return r
  }
  async function clickAny(text) {
    const r = await page.evaluate(t => {
      const leaves = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent?.trim().includes(t))
      if (!leaves.length) return 'NOT_FOUND'
      leaves[0].click()
      return 'OK'
    }, text)
    console.log(`🖱️ 点击元素「${text}」→ ${r}`)
    await sleep(2_000)
    return r
  }
  async function goto(hash) {
    await page.evaluate(h => { window.location.hash = h }, hash)
    await sleep(2_500)
  }
  async function bodyText() {
    return await page.evaluate(() => document.body.innerText)
  }

  // ============ 1. 音标规范化（带实时进度显示） ============
  console.log('\n=== 1. 音标规范化 ===')
  await goto('#/editor')
  await clickBtn('音标规范化')
  // 每 2 秒打印一次进度条文字，直到出现结果横幅（最长 240 秒）
  let done = false
  for (let i = 0; i < 120; i++) {
    const t = await bodyText()
    if (t.includes('已规范化') || t.includes('没有需要规范化的音标')) { done = true; break }
    const m = t.match(/音标规范化中\.\.\.\s*([\d\s]+)\/\s*([\d]+)/)
    if (m) process.stdout.write(`\r   进度: ${m[1].trim()} / ${m[2]}   `)
    else if (i > 2) process.stdout.write(`\r   处理中... (第${i * 2}秒)   `)
    await sleep(2_000)
  }
  console.log(done ? '\n✅ 音标规范化完成' : '\n❌ 音标规范化超时')
  await ss('01-音标规范化结果')

  // ============ 2. 搜索 art ============
  console.log('\n=== 2. 搜索 ===')
  await goto('#/search')
  await page.locator('input[placeholder*="输入单词或释义"]').fill('art')
  await clickBtn('搜索')
  let found = false
  for (let i = 0; i < 15; i++) {
    if ((await bodyText()).includes('找到')) { found = true; break }
    await sleep(2_000)
  }
  const firstWord = await page.evaluate(() => document.querySelector('span.text-lg')?.textContent?.trim() ?? '?')
  console.log('第一个搜索结果:', firstWord, firstWord === 'art' ? '✅' : found ? '❌ 期望 art' : '❌ 未出结果')
  await ss('02-搜索art')
  const cardClick = await page.evaluate(() => {
    const el = document.querySelector('span.text-lg')
    if (!el) return 'NOT_FOUND'
    const card = el.closest('div[class*="rounded-lg"][class*="border"]')
    if (!card) return 'NOT_FOUND'
    card.click()
    return 'OK'
  })
  console.log('🖱️ 点击结果卡片 →', cardClick)
  await sleep(2_000)
  await ss('03-点击卡片后编辑面板')

  // ============ 3. 分类浏览：根类 + 子类 ============
  console.log('\n=== 3. 分类浏览 ===')
  await goto('#/categories')
  await clickAny('日常生活')
  await ss('04-选中根分类')
  await clickAny('饮食')
  let hasWords = false
  for (let i = 0; i < 10; i++) {
    if ((await bodyText()).includes('的单词')) { hasWords = true; break }
    await sleep(2_000)
  }
  console.log(hasWords ? '✅ 子分类单词列表出现' : '❌ 子分类单词列表未出现')
  await ss('05-子分类单词列表')

  // ============ 汇总 ============
  const realErrors = consoleErrors.filter(e => !e.includes('DevTools'))
  console.log('\n=== 错误汇总 ===')
  console.log('console 错误:', realErrors.length, '| 页面异常:', pageErrors.length)
  realErrors.slice(0, 8).forEach(e => console.log('  -', e.slice(0, 200)))
  await app.close()
  process.exit(0)
}
main().catch(err => { console.error('脚本失败:', err); process.exit(2) })
