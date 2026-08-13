/**
 * 用户旅程驱动脚本 —— 以真实使用者的方式打开应用、点击页面、截图、收集错误。
 * 用法: node scripts/user-journey.mjs
 * 输出: shots/ 目录下的截图 + 控制台错误清单
 */
import { _electron as electron } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const SHOTS = join(ROOT, 'shots')
mkdirSync(SHOTS, { recursive: true })

const consoleErrors = []   // 渲染进程 console 错误
const pageErrors = []      // 渲染进程未捕获异常
const ipcErrors = []       // 主进程 IPC handler 错误

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log('=== 启动应用 ===')
  // 剔除 ELECTRON_RUN_AS_NODE / NODE_OPTIONS —— 它们会让 electron.exe 伪装成 node.exe，
  // 导致调试端口参数被拒绝、应用无法以 Electron 方式启动
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

  // 监听主进程 stdout/stderr 中的 IPC 错误
  app.process().stderr.on('data', d => {
    const s = String(d)
    if (s.includes('Error') && !s.includes('[ERROR:') ) ipcErrors.push(s.trim().slice(0, 300))
  })

  await sleep(6_000)
  const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow()
  console.log('窗口 URL:', page.url())

  // 收集渲染进程错误
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => pageErrors.push(String(err)))
  // 自动接受 alert/confirm 弹窗
  page.on('dialog', d => d.accept())

  // 截图 + 点击工具函数（DOM 点击，避开坐标问题）
  let shotIdx = 0
  async function ss(name) {
    shotIdx++
    const f = join(SHOTS, `${String(shotIdx).padStart(2, '0')}-${name}.png`)
    await page.screenshot({ path: f })
    console.log(`📸 ${f}`)
  }
  async function clickText(text, inMain = false) {
    const r = await page.evaluate(([t, m]) => {
      const scope = m ? document.querySelector('main') ?? document : document
      const els = [...scope.querySelectorAll('a, button, [role="button"]')]
      const el = els.find(e => e.textContent?.trim() === t) ?? els.find(e => e.textContent?.includes(t))
      if (!el) return 'NOT_FOUND'
      el.click()
      return 'OK'
    }, [text, inMain])
    console.log(`🖱️ 点击「${text}」${inMain ? '(主区域)' : ''}→ ${r}`)
    await sleep(1_500)
    return r
  }
  async function bodyText() {
    return await page.evaluate(() => document.body.innerText)
  }

  // ============ 1. 导入页 ============
  console.log('\n=== 1. 导入页 ===')
  await ss('01-import')

  // ============ 2. 单词检修 ============
  console.log('\n=== 2. 单词检修 ===')
  await clickText('单词检修')
  await ss('02-editor-initial')
  await clickText('开始检查')
  await sleep(3_000)
  await ss('03-editor-checked')
  const editorText = await bodyText()
  console.log('检修页状态:', editorText.includes('数据一切正常') ? '一切正常' : (editorText.match(/共检查 (\d+) 个单词/) || ['', '未知'])[1] + ' 个单词，有问题列表')

  // ============ 3. 词典补全 ============
  console.log('\n=== 3. 词典补全 ===')
  const hasDictBtn = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent?.includes('词典补全')))
  if (hasDictBtn) {
    await clickText('词典补全', true)
    // 等待补全完成：轮询「修复中...」按钮消失（最长 90 秒，词典 68MB 加载需要时间）
    let waited = 0
    for (let i = 0; i < 60; i++) {
      await sleep(1_500)
      waited += 1.5
      const stillFixing = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some(x => x.textContent?.includes('修复中'))
      )
      if (!stillFixing) break
    }
    console.log(`补全等待 ${waited.toFixed(0)} 秒后结束`)
    await sleep(2_000) // 等结果框渲染
    await ss('04-editor-after-dictfix')
    const fixText = await bodyText()
    const m = fixText.match(/已词典补全 (\d+) 个单词|词典补全失败|没有需要词典补全的内容/)
    console.log('词典补全结果:', m ? m[0] : '（未显示结果框）')
  } else {
    console.log('没有「词典补全」按钮（可能数据已完整或未检查）')
  }

  // ============ 4. 单词列表 ============
  console.log('\n=== 4. 单词列表 ===')
  await clickText('单词列表')
  await sleep(1_000)
  await ss('05-wordlist')
  const listText = await bodyText()
  console.log('列表状态:', listText.includes('暂无单词') ? '空' : '有数据')

  // ============ 5. 搜索 ============
  console.log('\n=== 5. 搜索 ===')
  await clickText('搜索')
  await sleep(1_000)
  await page.evaluate(() => {
    const input = document.querySelector('main input[type="text"]')
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, 'a')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await clickText('搜索', true)
  await sleep(2_000)
  await ss('06-search-results')
  const searchText = await bodyText()
  console.log('搜索结果:', searchText.includes('个结果') ? '有结果' : searchText.includes('未找到') ? '未找到' : '?')

  // ============ 6. 分类浏览 ============
  console.log('\n=== 6. 分类浏览 ===')
  await clickText('分类浏览')
  await sleep(1_000)
  await ss('07-categories')

  // ============ 7. 设置 ============
  console.log('\n=== 7. 设置 ===')
  await clickText('设置')
  await sleep(1_000)
  await ss('08-settings')

  // ============ 汇总 ============
  console.log('\n\n========== 错误汇总 ==========')
  console.log(`渲染进程 console 错误: ${consoleErrors.length} 条`)
  for (const e of [...new Set(consoleErrors)]) console.log('  ❌', e.slice(0, 200))
  console.log(`页面未捕获异常: ${pageErrors.length} 条`)
  for (const e of pageErrors) console.log('  ❌', e.slice(0, 200))
  console.log(`主进程 IPC 错误: ${ipcErrors.length} 条`)
  for (const e of [...new Set(ipcErrors)]) console.log('  ❌', e)
  console.log('========== 旅程结束 ==========')

  await app.close()
}

main().catch(e => { console.error('旅程脚本失败:', e); process.exit(1) })
