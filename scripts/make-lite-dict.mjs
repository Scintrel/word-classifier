/**
 * 从完整大词典裁剪出「精简版词典」（ecdict-lite.json）：
 * 只保留有音标的词条（约 22 万条），体积从 66.9MB 降到 ~19MB，
 * 可以直接提交进 Git 仓库——克隆项目的人开箱即用，无需下载 66MB 大文件。
 *
 * 用法: node scripts/make-lite-dict.mjs
 * 输入: resources/ecdict-dict.json（完整版，本机才有）
 * 输出: resources/ecdict-lite.json
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs'

console.log('读取完整词典...')
const dict = JSON.parse(readFileSync('resources/ecdict-dict.json', 'utf-8'))

let kept = 0
const lite = []
for (const e of dict) {
  // 保留标准：有音标，或有考试标签/词频（无音标的常见词靠释义+等级数据仍有用）
  if (
    (e.phonetic && e.phonetic.length > 2) ||
    e.tag ||
    (e.frq && e.frq > 0)
  ) {
    lite.push(e)
    kept++
  }
}

const out = 'resources/ecdict-lite.json'
writeFileSync(out, JSON.stringify(lite))
const mb = (statSync(out).size / 1024 / 1024).toFixed(1)
console.log(`精简版已生成: ${kept} 条词条, ${mb} MB（完整版 ${dict.length} 条, 66.9MB）`)
