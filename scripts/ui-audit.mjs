/** UI 审查脚本：补拍缺失页面 + DOM 级遮挡/溢出检测（只输出观察数据，不修改任何数据） */
import { _electron as electron } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const SHOTS = join(ROOT, 'shots')
mkdirSync(SHOTS, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const childEnv = { ...process.env }
  delete childEnv.ELECTRON_RUN_AS_NODE
  delete childEnv.NODE_OPTIONS
  const app = await electron.launch({
    executablePath: join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: ['.'], cwd: ROOT,
    env: { ...childEnv, ELECTRON_ENABLE_LOGGING: '1' }, timeout: 30_000,
  })
  await sleep(6_000)
  const page = app.windows().find(w => !w.url().startsWith('devtools://')) ?? await app.firstWindow()
  page.on('dialog', d => d.accept())

  async function goto(hash) {
    await page.evaluate(h => { window.location.hash = h }, hash)
    await sleep(2_500)
  }
  async function ss(name) {
    const f = join(SHOTS, name)
    await page.screenshot({ path: f })
    console.log('📸', name)
  }
  async function audit(label) {
    const data = await page.evaluate(() => {
      const out = { label: '', docW: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth, hOverflow: false, fixed: [], truncatedCells: 0, badgeCounts: [] }
      out.hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
      document.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el)
        if (cs.position === 'fixed' && el.offsetWidth > 0) out.fixed.push(`${el.tagName}.${(el.className || '').toString().slice(0, 30)} ${el.offsetWidth}x${el.offsetHeight}`)
        if (el.tagName === 'TD' && el.scrollWidth > el.clientWidth + 4) out.truncatedCells++
      })
      // 每行徽章数量分布（等级列）
      const rows = [...document.querySelectorAll('tbody tr')]
      out.rowHeights = rows.slice(0, 50).map(r => r.offsetHeight)
      return out
    })
    console.log(`\n🔍 [${label}] 视口宽${data.docW} 内容宽${data.scrollW}${data.hOverflow ? ' ⚠️水平溢出' : ''} 截断单元格${data.truncatedCells}`)
    if (data.fixed.length) { console.log('   固定层:', data.fixed.join(' | ')) }
    if (data.rowHeights.length) console.log('   行高分布:', Math.min(...data.rowHeights), '~', Math.max(...data.rowHeights), 'px')
    return data
  }

  await ss('ui-01-import.png'); await audit('导入页')
  await goto('#/editor')
  await ss('ui-02-editor-empty.png'); await audit('检修页(空态)')
  await goto('#/words')
  await ss('ui-03-words.png'); await audit('单词列表')
  // 打开编辑面板
  await page.evaluate(() => {
    const tr = document.querySelector('tbody tr')
    tr?.click()
  })
  await sleep(2_000)
  await ss('ui-04-word-detail-new.png'); await audit('单词列表+编辑面板')
  // 深色模式
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
    localStorage.setItem('app-theme', 'dark')
  })
  await sleep(1_500)
  await ss('ui-05-words-dark.png'); await audit('单词列表(深色)')
  await goto('#/categories')
  await ss('ui-06-categories.png'); await audit('分类浏览')
  await goto('#/search')
  await ss('ui-07-search-empty.png'); await audit('搜索(空态)')
  await goto('#/settings')
  await ss('ui-08-settings.png'); await audit('设置')
  await goto('#/import')
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await app.close()
  console.log('\n✅ 审查完成')
}
main().catch(e => { console.error('失败:', e); process.exit(2) })
