/**
 * 11 项修复的真机验证脚本 —— 以真实使用者的方式走完整流程并截图。
 * 用法: node scripts/verify-11.mjs
 * 输出: shots/ 目录截图 + 控制台错误清单
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
const mainLogs = []
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
  app.process().stdout.on('data', d => mainLogs.push(String(d)))
  app.process().stderr.on('data', d => mainLogs.push(String(d)))

  await sleep(6_000)
  const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow()
  console.log('窗口 URL:', page.url())
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
  /** 点击文本匹配的按钮 */
  async function clickBtn(text) {
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button')]
      const el = els.find(e => e.textContent?.trim().includes(t))
      if (!el) return 'NOT_FOUND'
      el.click()
      return 'OK'
    }, text)
    console.log(`🖱️ 点击按钮「${text}」→ ${r}`)
    await sleep(2_000)
    return r
  }
  /** 点击任意文本匹配的叶子元素（用于分类树等 div） */
  async function clickAny(text) {
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('*')]
      const leaves = els.filter(e => e.children.length === 0 && e.textContent?.trim().includes(t))
      if (!leaves.length) return 'NOT_FOUND'
      leaves[0].click()
      return 'OK'
    }, text)
    console.log(`🖱️ 点击元素「${text}」→ ${r}`)
    await sleep(2_000)
    return r
  }
  async function setSelect(nth, value) {
    const r = await page.evaluate(([n, v]) => {
      const sels = [...document.querySelectorAll('select')]
      const s = sels[n]
      if (!s) return 'NOT_FOUND'
      s.value = v
      s.dispatchEvent(new Event('change', { bubbles: true }))
      return 'OK'
    }, [nth, value])
    console.log(`🎛️ 第${nth}个下拉选「${value}」→ ${r}`)
    await sleep(2_000)
    return r
  }
  async function bodyText() {
    return await page.evaluate(() => document.body.innerText)
  }
  /** 轮询直到正文出现某段文字（最长 maxSec 秒） */
  async function waitText(text, maxSec = 180) {
    for (let i = 0; i < maxSec / 2; i++) {
      const t = await bodyText()
      if (t.includes(text)) { console.log(`✅ 出现「${text}」`); return true }
      await sleep(2_000)
    }
    console.log(`❌ 超时未出现「${text}」`)
    return false
  }
  async function goto(hash) {
    await page.evaluate(h => { window.location.hash = h }, hash)
    await sleep(2_500)
    console.log(`🧭 跳转 ${hash}`)
  }

  // ============ 0. 迁移日志 ============
  console.log('\n=== 0. 启动迁移 ===')
  const migLog = mainLogs.join('')
  console.log(migLog.includes('003_category_colors') ? '✅ 迁移 003 已执行' : '⚠️ 未看到迁移 003 日志（可能此前已执行过）')

  // ============ 1. 单词检修：检查 → 词典补全 ============
  console.log('\n=== 1. 单词检修 ===')
  await goto('#/editor')
  await clickBtn('开始检查')
  await waitText('缺少音标', 60)
  await ss('01-检修检查结果')
  const issuesText = await bodyText()
  const m = issuesText.match(/缺少音标 \((\d+)\)/)
  console.log('缺少音标问题数:', m ? m[1] : '?')

  await clickBtn('词典补全')
  await waitText('已词典补全', 300)
  await ss('02-词典补全完成')

  // ============ 2. 音标规范化 ============
  console.log('\n=== 2. 音标规范化 ===')
  await clickBtn('音标规范化')
  await waitText('已规范化', 300)
  await ss('03-音标规范化完成')

  // ============ 3. 等级词频回填 ============
  console.log('\n=== 3. 等级词频回填 ===')
  await clickBtn('等级词频回填')
  await waitText('已回填', 300)
  await ss('04-等级词频回填完成')

  // 重新检查看剩余问题
  await clickBtn('重新检查')
  await waitText('缺少音标', 60)
  await ss('05-修复后复查')

  // ============ 4. 单词列表 + 筛选 ============
  console.log('\n=== 4. 单词列表 ===')
  await goto('#/words')
  await waitText('共', 30)
  await ss('06-单词列表(等级词频徽章)')

  await setSelect(1, 'ielts')   // 等级=雅思
  await ss('07-等级筛选-雅思')
  await setSelect(1, 'all')
  await setSelect(2, 'top')     // 词频=超高频
  await ss('08-词频筛选-超高频')
  await setSelect(2, 'all')
  await setSelect(3, 'noun')    // 词性=名词
  await ss('09-词性筛选-名词')
  await setSelect(3, 'all')

  // 问号帮助
  const helpR = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="筛选说明"]')
    if (!b) return 'NOT_FOUND'
    b.click()
    return 'OK'
  })
  console.log('🖱️ 点开「筛选说明」问号 →', helpR)
  await sleep(1_500)
  await ss('10-筛选说明问号弹窗')

  // ============ 5. 搜索 ============
  console.log('\n=== 5. 搜索 ===')
  await goto('#/search')
  await page.locator('input[placeholder*="输入单词或释义"]').fill('art')
  await sleep(1_000)
  await clickBtn('搜索')
  await waitText('找到', 30)
  const firstWord = await page.evaluate(() => {
    const el = document.querySelector('span.text-lg')
    return el?.textContent?.trim() ?? '?'
  })
  console.log('第一个搜索结果:', firstWord, firstWord === 'art' ? '✅' : '❌ 期望 art')
  await ss('11-搜索art结果')
  // 点击第一个结果卡片打开编辑面板
  const cardClick = await page.evaluate(() => {
    const el = document.querySelector('span.text-lg')
    if (!el) return 'NOT_FOUND'
    const card = el.closest('div[class*="rounded-lg"][class*="border"]')
    if (!card) return 'NOT_FOUND'
    card.click()
    return 'OK'
  })
  console.log('🖱️ 点击搜索结果卡片 →', cardClick)
  await sleep(2_000)
  await ss('12-搜索结果点击编辑')

  // ============ 6. 分类浏览 ============
  console.log('\n=== 6. 分类浏览 ===')
  await goto('#/categories')
  await waitText('已分类单词', 30)
  await clickAny('日常生活')
  await ss('13-选中根分类')
  await clickAny('饮食')
  await waitText('的单词', 30)
  await ss('14-子分类单词列表')

  // ============ 7. 汇总 ============
  console.log('\n=== 7. 错误汇总 ===')
  const realErrors = consoleErrors.filter(e => !e.includes('DevTools'))
  console.log('渲染进程 console 错误:', realErrors.length)
  realErrors.slice(0, 10).forEach(e => console.log('  -', e.slice(0, 200)))
  console.log('页面未捕获异常:', pageErrors.length)
  pageErrors.slice(0, 5).forEach(e => console.log('  -', e.slice(0, 200)))
  console.log(realErrors.length + pageErrors.length === 0 ? '\n🎉 全程无错误！' : '\n⚠️ 存在错误，见上方清单')

  await app.close()
  process.exit(realErrors.length + pageErrors.length === 0 ? 0 : 1)
}

main().catch(err => { console.error('脚本失败:', err); process.exit(2) })
