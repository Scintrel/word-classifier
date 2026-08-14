import { getDatabase } from '../database/connection'
import { queryAll } from '../database/utils'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface DictEntry {
  word: string
  phonetic: string
  definition: string
  pos: string
  /** ECDICT 考试标签（空格连接，如 "gk cet4 cet6"） */
  tag?: string
  /** COCA 词频排名（数字越小越常用；无排名时不存储） */
  frq?: number | null
}

let DICT_MAP: Map<string, DictEntry> | null = null
let dictLoaded = false

// 用户小词典（开发者模式里维护）：优先级高于 ECDICT 大词典
let USER_DICT: Map<string, DictEntry> | null = null
let userDictLoaded = false

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
  // 优先级：完整大词典（本机）→ 精简版（随仓库分发）→ 备用小词典
  const fns = ['ecdict-dict.json', 'ecdict-lite.json', 'dictionary.json']
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

/**
 * 音标规范化：
 * 1. ECDICT 的西里尔字符 ә(U+04D9)/є(U+0454) 转成标准 IPA ə(U+0259)/ɛ(U+025B)
 * 2. 没有 // 包裹且看起来像音标的（不含中文/数字），补上 //
 * 3. 已经是 /.../ 格式或明显不是音标的内容原样返回
 */
export function normalizePhonetic(p: string | null | undefined): string | null {
  if (!p) return null
  let t = p.trim()
  if (!t) return null
  t = t.replace(/ә/g, 'ə').replace(/є/g, 'ɛ')
  if (/^\/.*\/$/.test(t)) return t
  if (/[一-鿿]/.test(t) || /\d/.test(t)) return t
  return `/${t}/`
}

/**
 * Load the user's personal dictionary (dict_entries table) into memory.
 * 开发者模式里维护的小词典；用户修改后通过 resetUserDict() 让缓存失效。
 */
function loadUserDict(): void {
  if (userDictLoaded) return
  userDictLoaded = true
  try {
    const db = getDatabase()
    const rows = queryAll(db, 'SELECT word, phonetic, definition, pos FROM dict_entries')
    const map = new Map<string, DictEntry>()
    for (const r of rows) {
      const w = (r.word as string ?? '').trim()
      if (!w) continue
      map.set(w, {
        word: w,
        phonetic: (r.phonetic as string) ?? '',
        definition: (r.definition as string) ?? '',
        pos: (r.pos as string) ?? ''
      })
    }
    USER_DICT = map
    console.log(`User dict: ${map.size} entries`)
  } catch {
    // 数据库可能还没初始化（如纯查词场景），保持空词典
    USER_DICT = new Map()
  }
}

/** 小词典被修改后调用：让下次 lookupWord 重新读取 */
export function resetUserDict(): void {
  userDictLoaded = false
  USER_DICT = null
}

/**
 * 四步回退查找：精确 → 全小写 → 首字母大写 → 全大写。
 * 全大写是必须的：ECDICT 里 CORE、FAX 等词条以全大写存储（如缩写词），
 * 缺这一步会导致明明有音标却补不上。
 */
function findInMap(map: Map<string, DictEntry>, t: string): DictEntry | null {
  const exact = map.get(t)
  if (exact) return exact
  const lower = map.get(t.toLowerCase())
  if (lower) return lower
  const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
  const capped = map.get(cap)
  if (capped) return capped
  return map.get(t.toUpperCase()) ?? null
}

export function lookupWord(word: string): DictEntry | null {
  // 1. 用户小词典优先（开发者模式维护，可覆盖大词典）
  const userHit = lookupUserEntry(word)
  if (userHit) return userHit
  // 2. ECDICT 大词典
  return lookupDictEntry(word)
}

/** 只查用户小词典（开发者模式"查词试验场"区分来源用） */
export function lookupUserEntry(word: string): DictEntry | null {
  const t = word.trim()
  loadUserDict()
  return USER_DICT ? findInMap(USER_DICT, t) : null
}

/** 只查 ECDICT 大词典 */
export function lookupDictEntry(word: string): DictEntry | null {
  const t = word.trim()
  loadDictionary()
  return DICT_MAP ? findInMap(DICT_MAP, t) : null
}

/** ECDICT 大词典词条数（供开发者模式数据总览显示） */
export function dictEntryCount(): number {
  loadDictionary()
  return DICT_MAP?.size ?? 0
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
  phoneticUk?: string; phoneticUs?: string; definitionCn?: string; partOfSpeech?: string
  difficultyTags?: string[]; frq?: number | null; foundInDict: boolean
} {
  const entry = lookupWord(word)
  if (entry && (entry.phonetic || entry.definition || entry.pos)) {
    // ECDICT 只提供一套音标，英式美式两边共用（同一值）
    const phon = normalizePhonetic(entry.phonetic)
    return {
      phoneticUk: phon ?? undefined,
      phoneticUs: phon ?? undefined,
      definitionCn: entry.definition,
      // 词性优先级：词典 pos 字段 → 从词典释义开头提取（如 "vt. 放弃" → verb）→ 后缀规则
      partOfSpeech: entry.pos || extractPOSFromDef(entry.definition) || guessPOS(word) || undefined,
      difficultyTags: entry.tag ? entry.tag.split(/\s+/).filter(Boolean) : undefined,
      frq: entry.frq ?? null,
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
        OR phonetic_us IS NULL OR phonetic_us = ''
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
  // 英式或美式任一为空都算缺音标
  const words = queryAll(db,
    `SELECT id, word, phonetic_uk, phonetic_us, part_of_speech, definition_cn, definition_en FROM words
     WHERE phonetic_uk IS NULL OR phonetic_uk = ''
        OR phonetic_us IS NULL OR phonetic_us = ''
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
    // Only update fields that have real values（音标两边都填，缺哪边补哪边）
    const sets: string[] = []
    const params: unknown[] = []
    if (auto.phoneticUk) {
      if (!row.phonetic_uk) { sets.push('phonetic_uk = ?'); params.push(auto.phoneticUk) }
      if (!row.phonetic_us) { sets.push('phonetic_us = ?'); params.push(auto.phoneticUs) }
    }
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

/**
 * 需要规范化的判定：非空 且（无 // 包裹 或 含西里尔字符）。
 * ⚠️ WHERE 必须只选"还没规范化的"——否则修复后还会被下一批选中，
 * 每批都拿不到变化、done 提前返回，后面的词永远轮不到。
 */
const PHONETIC_DIRTY =
  `(phonetic_uk IS NOT NULL AND phonetic_uk != '' AND (phonetic_uk NOT LIKE '/%/' OR phonetic_uk LIKE '%ә%' OR phonetic_uk LIKE '%є%'))
   OR (phonetic_us IS NOT NULL AND phonetic_us != '' AND (phonetic_us NOT LIKE '/%/' OR phonetic_us LIKE '%ә%' OR phonetic_us LIKE '%є%'))`

/** Count words whose phonetics need normalization. */
export function normalizePhoneticsCount(): number {
  const db = getDatabase()
  const rows = db.exec(`SELECT COUNT(*) as c FROM words WHERE ${PHONETIC_DIRTY}`)
  return (rows[0]?.values[0]?.[0] as number) ?? 0
}

/**
 * Normalize existing phonetics in batches: 补 //、西里尔字符转标准 IPA。
 * 没有变化就不计修复数；一批里没有任何变化时 done=true，避免无限循环。
 */
export function normalizePhoneticsBatch(batchSize: number): { fixed: number; details: string[]; done: boolean } {
  const db = getDatabase()
  const words = queryAll(db,
    `SELECT id, word, phonetic_uk, phonetic_us FROM words
     WHERE ${PHONETIC_DIRTY}
     ORDER BY id LIMIT ?`,
    [batchSize]
  )
  if (words.length === 0) return { fixed: 0, details: [], done: true }

  let fixed = 0
  const details: string[] = []
  for (const row of words) {
    const wordId = row.id as number
    const uk = normalizePhonetic(row.phonetic_uk as string | null)
    const us = normalizePhonetic(row.phonetic_us as string | null)
    const sets: string[] = []
    const params: unknown[] = []
    if (uk !== (row.phonetic_uk as string | null)) { sets.push('phonetic_uk = ?'); params.push(uk) }
    if (us !== (row.phonetic_us as string | null)) { sets.push('phonetic_us = ?'); params.push(us) }
    if (sets.length === 0) continue
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(wordId)   // ⚠️ 永远最后
    db.run(`UPDATE words SET ${sets.join(', ')} WHERE id = ?`, params)
    fixed++
    details.push(`${row.word}`)
  }
  return { fixed, details, done: fixed === 0 || words.length < batchSize }
}

/** Count words whose difficulty/frequency need refilling. */
export function refillLevelsCount(): number {
  const db = getDatabase()
  const rows = db.exec(
    `SELECT COUNT(*) as c FROM words WHERE
       difficulty IS NULL OR difficulty = '' OR difficulty = 'unknown'`
  )
  return (rows[0]?.values[0]?.[0] as number) ?? 0
}

/**
 * Fill difficulty (exam tags, comma-joined) and frequency (COCA rank) from the dictionary.
 *
 * WHERE 只按 difficulty 选词（不含 frequency 条件）——词典里没有标签的词填 'none' 哨兵值，
 * 保证这批词不会再被选中，循环必然收敛（不收敛会无限"修复"同一批词）。
 */
export function refillLevelsBatch(batchSize: number): { fixed: number; details: string[]; done: boolean } {
  const db = getDatabase()
  loadDictionary()
  if (!DICT_MAP || DICT_MAP.size === 0) {
    return { fixed: -1, details: ['词典文件未找到，无法回填等级和词频。'], done: true }
  }
  const words = queryAll(db,
    `SELECT id, word, difficulty, frequency FROM words
     WHERE difficulty IS NULL OR difficulty = '' OR difficulty = 'unknown'
     ORDER BY id LIMIT ?`,
    [batchSize]
  )
  if (words.length === 0) return { fixed: 0, details: [], done: true }

  let fixed = 0
  const details: string[] = []
  for (const row of words) {
    const wordId = row.id as number
    const word = (row.word as string).trim()
    const entry = lookupWord(word)
    const sets: string[] = []
    const params: unknown[] = []
    // 词典有标签 → 逗号连接；没有 → 'none' 哨兵（不再被本函数选中）
    sets.push('difficulty = ?')
    params.push(entry?.tag ? entry.tag.split(/\s+/).filter(Boolean).join(',') : 'none')
    if (row.frequency == null && entry?.frq != null && entry.frq > 0) {
      sets.push('frequency = ?'); params.push(entry.frq)
    }
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(wordId)   // ⚠️ 永远最后
    db.run(`UPDATE words SET ${sets.join(', ')} WHERE id = ?`, params)
    fixed++
    details.push(`${word}: 等级=${entry?.tag || '无'}, 词频=${entry?.frq ?? '无数据'}`)
  }
  return { fixed, details, done: fixed === 0 || words.length < batchSize }
}

