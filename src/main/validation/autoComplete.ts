import { getDatabase } from '../database/connection'
import { queryAll } from '../database/utils'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface DictEntry { word: string; phonetic: string; definition: string; pos: string }

let DICT_MAP: Map<string, DictEntry> | null = null
let dictLoaded = false

/**
 * Resolve possible resource directories without using __dirname
 * (which is not available in electron-vite's ESM bundle context).
 */
function getResourceDirs(): string[] {
  const dirs: string[] = []

  // 1. Electron app path (works in both dev and packaged)
  try {
    const { app } = require('electron')
    if (app.isPackaged) {
      // Packaged: resources/ is alongside the app.asar
      dirs.push(join(process.resourcesPath!, 'resources'))
    }
    dirs.push(join(app.getAppPath(), 'resources'))
    // Also try parent of app path (for electron-vite dev where appPath is out/main)
    dirs.push(join(app.getAppPath(), '..', 'resources'))
  } catch {}

  // 2. Current working directory (dev mode from project root)
  dirs.push(join(process.cwd(), 'resources'))
  dirs.push(join(process.cwd(), 'out', 'resources'))

  return dirs
}

function loadDictionary(): void {
  if (dictLoaded) return
  dictLoaded = true
  const dirs = getResourceDirs()
  const fns = ['ecdict-dict.json', 'dictionary.json']
  for (const dir of dirs) {
    for (const fn of fns) {
      const p = join(dir, fn)
      if (!existsSync(p)) continue
      try {
        const data = JSON.parse(readFileSync(p, 'utf-8'))
        if (Array.isArray(data) && data.length > 0) {
          const map = new Map<string, DictEntry>()
          // 保留原始大小写作为键（China ≠ china），不用 toLowerCase 合并
          for (const e of data) { const k = (e.word || '').trim(); if (k && !map.has(k)) map.set(k, e) }
          DICT_MAP = map
          console.log(`Dict: ${map.size} entries from ${p}`)
          return
        }
      } catch (e) { console.warn('Dict parse error:', e) }
    }
  }
  // All paths failed — allow retry on next call (e.g. user added dict file)
  DICT_MAP = new Map()
  dictLoaded = false
  console.warn('Dict not found, searched:', dirs)
}

export function lookupWord(word: string): DictEntry | null {
  loadDictionary()
  if (!DICT_MAP) return null
  const t = word.trim()
  // 1. 精确匹配（区分大小写：China ≠ china）
  const exact = DICT_MAP.get(t)
  if (exact) return exact
  // 2. 全小写回退（单词表常用小写，词典词条可能大写开头）
  const lower = DICT_MAP.get(t.toLowerCase())
  if (lower) return lower
  // 3. 首字母大写回退（词典只有 China，用户写 china）
  const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  return DICT_MAP.get(cap) ?? null
}

/** Pattern-based POS guessing from word suffixes. */
function guessPOS(word: string): string | null {
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

/**
 * Extract POS from definition text like "n.能力" or "vt.丢弃".
 * 扫描整个释义，收集出现的所有词性（一个词可以有多个词性，
 * 如 "vt. 放弃...；n. 放任" → "verb,noun"）。
 */
export function extractPOSFromDef(def: string): string | null {
  if (!def) return null
  const posMap: Record<string, string> = {
    'n.': 'noun', 'noun': 'noun', 'pl.': 'noun', 'plural': 'noun',
    'v.': 'verb', 'verb': 'verb',
    'vt.': 'verb', 'vt': 'verb',
    'vi.': 'verb', 'vi': 'verb',
    'adj.': 'adjective', 'adj': 'adjective', 'a.': 'adjective',
    'adv.': 'adverb', 'adv': 'adverb', 'ad.': 'adverb',
    'prep.': 'preposition', 'prep': 'preposition',
    'pron.': 'pronoun', 'pron': 'pronoun',
    'conj.': 'conjunction', 'conj': 'conjunction',
    'int.': 'interjection', 'interj': 'interjection', 'interj.': 'interjection',
    'art.': 'article',
    'abbr.': 'abbreviation', 'abbr': 'abbreviation',
    'aux.': 'auxiliary',
    'num.': 'numeral',
    'suf.': 'suffix', 'suffix': 'suffix',
    'pref.': 'prefix', 'prefix': 'prefix',
  }
  // 用全局正则扫描整个释义，收集所有词性标记（去重、保序）。
  // 要求标记后跟点/空格/中文，避免 "vi" 误匹配 "video" 这类单词内部。
  const found: string[] = []
  const re = /([a-z]+\.?)(?=[\s.一-鿿]|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(def)) !== null) {
    const key = m[1].toLowerCase()
    const pos = posMap[key]
    if (pos && !found.includes(pos)) found.push(pos)
    // 只扫描释义前半部分（后半部分通常是例句/补充说明，词性标记都集中在开头）
    if (m.index > 120) break
  }
  return found.length > 0 ? found.join(',') : null
}

/** Get auto-completion suggestions for a word. */
export function getAutoComplete(word: string, existingDef?: string): {
  phoneticUk?: string; definitionCn?: string; partOfSpeech?: string; foundInDict: boolean
} {
  const entry = lookupWord(word)
  if (entry && (entry.phonetic || entry.definition || entry.pos)) {
    return {
      phoneticUk: entry.phonetic,
      definitionCn: entry.definition,
      // 词性优先级：词典 pos 字段 → 从词典释义开头提取（如 "vt. 放弃" → verb）→ 后缀规则
      partOfSpeech: entry.pos || extractPOSFromDef(entry.definition) || guessPOS(word) || undefined,
      foundInDict: true
    }
  }
  // Try suffix-based guessing
  const pos = guessPOS(word)
  if (!pos && existingDef) {
    const extractedPos = extractPOSFromDef(existingDef)
    if (extractedPos) return { partOfSpeech: extractedPos, foundInDict: false }
  }
  return { partOfSpeech: pos ?? undefined, foundInDict: false }
}

/** Count how many words need auto-completion. */
export function autoCompleteCount(): number {
  const db = getDatabase()
  const rows = db.exec(
    `SELECT COUNT(*) as c FROM words
     WHERE phonetic_uk IS NULL OR phonetic_uk = ''
        OR definition_cn IS NULL OR definition_cn = ''
        OR part_of_speech IS NULL OR part_of_speech = ''
        OR part_of_speech = 'unknown'`
  )
  return (rows[0]?.values[0]?.[0] as number) ?? 0
}

/** Process one batch of auto-completion. Returns { fixed, details, done }. */
export function autoCompleteBatch(batchSize: number): { fixed: number; details: string[]; done: boolean } {
  const db = getDatabase()
  // 先尝试加载词典（首次调用时 DICT_MAP 还是 null），再检查是否加载成功
  loadDictionary()
  // If dictionary failed to load, don't pretend to fix — only POS guessing would run
  if (!DICT_MAP || DICT_MAP.size === 0) {
    return { fixed: -1, details: ['词典文件未找到，无法补全音标和释义。请将词典文件放入 resources/ 目录。'], done: true }
  }
  // Get next batch of incomplete words, ordered by id (参数化查询，防止注入)
  const words = queryAll(db,
    `SELECT id, word, phonetic_uk, part_of_speech, definition_cn, definition_en FROM words
     WHERE phonetic_uk IS NULL OR phonetic_uk = ''
        OR definition_cn IS NULL OR definition_cn = ''
        OR part_of_speech IS NULL OR part_of_speech = ''
        OR part_of_speech = 'unknown'
     ORDER BY id LIMIT ?`,
    [batchSize]
  )
  if (words.length === 0) return { fixed: 0, details: [], done: true }

  let fixed = 0
  const details: string[] = []
  for (const row of words) {
    const wordId = row.id as number
    const word = (row.word as string).trim()
    const existingDef = ((row.definition_cn as string) || (row.definition_en as string) || '').trim()
    const auto = getAutoComplete(word, existingDef)
    if (!auto.foundInDict && !auto.partOfSpeech) continue
    // Only update fields that have real values
    const sets: string[] = []
    const params: unknown[] = []
    if (auto.phoneticUk) { sets.push('phonetic_uk = ?'); params.push(auto.phoneticUk) }
    if (auto.definitionCn) { sets.push('definition_cn = ?'); params.push(auto.definitionCn) }
    if (auto.partOfSpeech) { sets.push('part_of_speech = ?'); params.push(auto.partOfSpeech) }
    if (sets.length === 0) continue
    sets.push('updated_at = CURRENT_TIMESTAMP')
    // If pos still null, try to fill it so word won't be re-selected
    if (!auto.partOfSpeech && (row.part_of_speech === null || (row.part_of_speech as string) === '')) {
      const defPos = extractPOSFromDef(existingDef)
      const suffixPos = guessPOS(word)
      const fallbackPos = defPos || suffixPos || 'unknown'
      sets.push('part_of_speech = ?'); params.push(fallbackPos)
    }
    // ⚠️ wordId 必须最后推入：SQL 里它对应 WHERE id = ? 的最后一个占位符。
    // 若推在中间，后面的占位符会错位——UPDATE 匹配不到任何行，假报"已修复"但什么都没改。
    params.push(wordId)
    db.run(`UPDATE words SET ${sets.join(', ')} WHERE id = ?`, params)
    fixed++
    const parts: string[] = []
    if (auto.phoneticUk) parts.push('音标')
    if (auto.definitionCn) parts.push('释义')
    if (auto.partOfSpeech || (row.part_of_speech === null) || ((row.part_of_speech as string) === '')) parts.push('词性')
    details.push(`${word}: ${parts.join('、')}${auto.foundInDict ? ' (词典)' : ' (规则推测)'}`)
  }
  // 本批什么都没修成时，把 done 置为 true——否则下一批还会选中同样的词，界面会无限循环
  return { fixed, details, done: fixed === 0 || words.length < batchSize }
}

