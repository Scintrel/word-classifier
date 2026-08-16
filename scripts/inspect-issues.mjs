/**
 * 检查用户真实数据库（%APPDATA%/word-classifier/word-classifier.db）：
 * 1. 列出所有校验问题（缺音标/缺释义/词性未设置/音标格式异常等）
 * 2. 对每个问题词模拟「词典补全」的查词逻辑，判断是否真的修得了
 * 3. 输出「查不到词典 → 无法自动修复」的词清单
 *
 * 用法: node scripts/inspect-issues.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import initSqlJs from 'sql.js'

const require = createRequire(import.meta.url)
const SQL = await initSqlJs({ locateFile: f => require.resolve('sql.js/dist/' + f) })

// ---------- 1. 打开用户数据库 ----------
const dbPath = join(homedir(), 'AppData', 'Roaming', 'word-classifier', 'word-classifier.db')
if (!existsSync(dbPath)) { console.error('找不到用户数据库:', dbPath); process.exit(1) }
const db = new SQL.Database(readFileSync(dbPath))
console.log('数据库:', dbPath, `(${(readFileSync(dbPath).length / 1024 / 1024).toFixed(1)} MB)`)

function q(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

// ---------- 2. 读取用户小词典 ----------
const userDict = new Map(q('SELECT word, phonetic, definition, pos FROM dict_entries')
  .map(r => [String(r.word).trim(), r]))

// ---------- 3. 加载大词典（模拟 autoComplete.ts 的加载顺序：ecdict-dict.json → ecdict-lite.json） ----------
const resourceDirs = [join(process.cwd(), 'resources')]
const fns = ['ecdict-dict.json', 'ecdict-lite.json']
let dict = new Map(), dictSource = ''
for (const dir of resourceDirs) {
  for (const fn of fns) {
    const p = join(dir, fn)
    if (!existsSync(p)) continue
    const data = JSON.parse(readFileSync(p, 'utf-8'))
    if (Array.isArray(data) && data.length > 0) {
      dict = new Map()
      for (const e of data) { const k = (e.word || '').trim(); if (k && !dict.has(k)) dict.set(k, e) }
      dictSource = `${fn} (${data.length} 条)`
      break
    }
  }
  if (dict.size > 0) break
}
console.log('大词典:', dictSource, '| 小词典:', userDict.size, '条')

// 与 autoComplete.ts 完全一致的四步回退查找
function findInMap(map, t) {
  if (!t) return null
  if (map.has(t)) return map.get(t)
  if (map.has(t.toLowerCase())) return map.get(t.toLowerCase())
  const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  if (map.has(cap)) return map.get(cap)
  return map.has(t.toUpperCase()) ? map.get(t.toUpperCase()) : null
}
function lookup(word) {
  return findInMap(userDict, word) ?? findInMap(dict, word) ?? null
}

// 与 autoComplete.ts 一致的后缀词性推测
function guessPOS(word) {
  const lower = word.toLowerCase()
  if (/tion$/.test(lower) || /sion$/.test(lower) || /ment$/.test(lower) || /ness$/.test(lower)) return 'noun'
  if (/ity$/.test(lower) || /ance$/.test(lower) || /ence$/.test(lower) || /hood$/.test(lower)) return 'noun'
  if (/ship$/.test(lower) || /ist$/.test(lower)) return 'noun'
  if (/(er|or)$/.test(lower) && lower.length > 4) return 'noun'
  if (/able$/.test(lower) || /ible$/.test(lower) || /ful$/.test(lower) || /less$/.test(lower)) return 'adjective'
  if (/ous$/.test(lower) || /ive$/.test(lower)) return 'adjective'
  if (/al$/.test(lower) && lower.length > 5) return 'adjective'
  if (/ly$/.test(lower) && lower.length > 4) return 'adverb'
  if (/ize$/.test(lower) || /ise$/.test(lower) || /ify$/.test(lower)) return 'verb'
  if (/ate$/.test(lower) && lower.length > 5) return 'verb'
  if (/en$/.test(lower) && lower.length > 4) return 'verb'
  return null
}

// ---------- 4. 扫描问题 ----------
const words = q('SELECT id, word, phonetic_uk, phonetic_us, definition_cn, definition_en, part_of_speech FROM words ORDER BY id')
console.log('\n总单词数:', words.length)

const issues = []
for (const w of words) {
  const word = String(w.word ?? '').trim()
  if (!word) { issues.push({ word: '(空)', type: '单词为空', id: w.id }); continue }
  const entry = lookup(word)
  const hasPhon = Boolean(entry && entry.phonetic && String(entry.phonetic).trim().length > 1)
  const hasDef = Boolean(entry && entry.definition && String(entry.definition).trim())
  const dictPos = entry?.pos || (entry?.definition ? /^[a-z]+\./.test(String(entry.definition)) ? '(from def)' : null : null)
  const posGuess = guessPOS(word)

  const missUk = !String(w.phonetic_uk ?? '').trim()
  const missUs = !String(w.phonetic_us ?? '').trim()
  if (missUk || missUs) {
    const side = missUk && missUs ? '英式美式均缺' : missUk ? '缺英式' : '缺美式'
    issues.push({ id: w.id, word, type: '缺音标', side, fixable: hasPhon, dict: entry ? '有词条' : '无词条' })
  }
  if (!String(w.definition_cn ?? '').trim() && !String(w.definition_en ?? '').trim()) {
    issues.push({ id: w.id, word, type: '缺释义', fixable: hasDef, dict: entry ? '有词条' : '无词条' })
  }
  const pos = String(w.part_of_speech ?? '').trim()
  if (!pos || pos === 'unknown') {
    issues.push({ id: w.id, word, type: '缺词性', fixable: Boolean(entry?.pos || posGuess), dict: entry ? '有词条' : '无词条', guess: posGuess ?? '-' })
  }
}

// ---------- 5. 汇总 ----------
const unfixable = issues.filter(i => i.fixable === false && (i.type === '缺音标' || i.type === '缺释义'))
console.log('\n===== 无法自动修复的问题（词典里查不到）=====')
const seen = new Set()
for (const i of unfixable) {
  if (seen.has(i.word)) continue
  seen.add(i.word)
  console.log(`  ${i.word}  (ID ${i.id})  ${i.type}${i.side ? ' ' + i.side : ''}`)
}
console.log(`共 ${[...seen].length} 个查不到的词`)

console.log('\n===== 全部问题统计 =====')
const byType = {}
for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1
console.log(byType)
console.log('总问题条数:', issues.length)

// 缺词性的词：即使查不到词典也可以靠后缀规则/兜底补上，单独列出
const posMissing = issues.filter(i => i.type === '缺词性' && !i.fixable)
console.log('\n缺词性且无法自动推测的词:', posMissing.map(i => `${i.word}`).join(', ') || '无')

// ---------- 6. 最近的小词典修改日志（大白话汇报用） ----------
console.log('\n===== 最近 10 条小词典修改日志 =====')
for (const l of q('SELECT * FROM change_log ORDER BY id DESC LIMIT 10')) {
  console.log(`  #${l.id} ${l.action.padEnd(6)} ${String(l.entity_key).padEnd(20)} ${l.changed_at || ''}`)
}

db.close()
