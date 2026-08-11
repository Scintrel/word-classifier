import { getDatabase } from '../database/connection'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface DictEntry { word: string; phonetic: string; definition: string; pos: string }

let DICT_MAP: Map<string, DictEntry> | null = null
let dictLoaded = false

function loadDictionary(): void {
  if (dictLoaded) return
  dictLoaded = true
  const dirs = [
    join(__dirname, '..', 'resources'),
    join(__dirname, '..', '..', 'resources'),
    join(__dirname, '..', '..', '..', 'resources'),
  ]
  try { const { app } = require('electron'); dirs.push(join(app.getAppPath(), 'resources')) } catch {}
  const fns = ['ecdict-dict.json', 'dictionary.json']
  for (const dir of dirs) {
    for (const fn of fns) {
      const p = join(dir, fn)
      if (!existsSync(p)) continue
      try {
        const data = JSON.parse(readFileSync(p, 'utf-8'))
        if (Array.isArray(data) && data.length > 0) {
          const map = new Map<string, DictEntry>()
          for (const e of data) { const k = (e.word || '').toLowerCase().trim(); if (k && !map.has(k)) map.set(k, e) }
          DICT_MAP = map
          console.log(`Dict: ${map.size} entries from ${p}`)
          return
        }
      } catch (e) { console.warn('Dict parse error:', e) }
    }
  }
  DICT_MAP = new Map()
  console.warn('Dict not found, searched:', dirs)
}

export function lookupWord(word: string): DictEntry | null {
  loadDictionary()
  if (!DICT_MAP) return null
  return DICT_MAP.get(word.toLowerCase().trim()) ?? null
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

/** Extract POS from definition text like "n.能力" or "vt.丢弃" */
export function extractPOSFromDef(def: string): string | null {
  if (!def) return null
  const posMap: Record<string, string> = {
    'n.': 'noun', 'noun': 'noun',
    'v.': 'verb', 'verb': 'verb',
    'vt.': 'verb', 'vt': 'verb',
    'vi.': 'verb', 'vi': 'verb',
    'adj.': 'adjective', 'adj': 'adjective', 'a.': 'adjective',
    'adv.': 'adverb', 'adv': 'adverb', 'ad.': 'adverb',
    'prep.': 'preposition', 'prep': 'preposition',
    'pron.': 'pronoun', 'pron': 'pronoun',
    'conj.': 'conjunction', 'conj': 'conjunction',
    'int.': 'interjection', 'interj': 'interjection',
    'art.': 'article',
    'abbr.': 'abbreviation', 'abbr': 'abbreviation',
    'aux.': 'auxiliary',
    'num.': 'numeral',
  }
  const m = def.match(/^([a-z]+\.?)/i)
  if (m) {
    const key = m[1].toLowerCase()
    return posMap[key] || null
  }
  return null
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
      partOfSpeech: entry.pos || guessPOS(word) || undefined,
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

/** Run auto-complete on all incomplete words. */
/** Count how many words need auto-completion. */
export function autoCompleteCount(): number {
  const db = getDatabase()
  const rows = db.exec(
    `SELECT COUNT(*) as c FROM words
     WHERE phonetic_uk IS NULL OR phonetic_uk = ''
        OR definition_cn IS NULL OR definition_cn = ''
        OR part_of_speech IS NULL OR part_of_speech = ''`
  )
  return (rows[0]?.values[0]?.[0] as number) ?? 0
}

/** Process one batch of auto-completion. Returns { fixed, details, done }. */
export function autoCompleteBatch(batchSize: number): { fixed: number; details: string[]; done: boolean } {
  const db = getDatabase()
  // Get next batch of incomplete words, ordered by id
  const rows = db.exec(
    `SELECT id, word, phonetic_uk, part_of_speech, definition_cn, definition_en FROM words
     WHERE phonetic_uk IS NULL OR phonetic_uk = ''
        OR definition_cn IS NULL OR definition_cn = ''
        OR part_of_speech IS NULL OR part_of_speech = ''
     ORDER BY id LIMIT ${batchSize}`
  )
  if (rows.length === 0 || rows[0].values.length === 0) return { fixed: 0, details: [], done: true }

  const words = rows[0].values.map(row => {
    const obj: Record<string, unknown> = {}
    rows[0].columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })

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
    params.push(wordId)
    // If pos still null, try to fill it so word won't be re-selected
    if (!auto.partOfSpeech && (row.part_of_speech === null || (row.part_of_speech as string) === '')) {
      const defPos = extractPOSFromDef(existingDef)
      const suffixPos = guessPOS(word)
      const fallbackPos = defPos || suffixPos || 'unknown'
      sets.push('part_of_speech = ?'); params.push(fallbackPos)
    }
    db.run(`UPDATE words SET ${sets.join(', ')} WHERE id = ?`, params)
    fixed++
    const parts: string[] = []
    if (auto.phoneticUk) parts.push('音标')
    if (auto.definitionCn) parts.push('释义')
    if (auto.partOfSpeech || (row.part_of_speech === null) || ((row.part_of_speech as string) === '')) parts.push('词性')
    details.push(`${word}: ${parts.join('、')}${auto.foundInDict ? ' (词典)' : ' (规则推测)'}`)
  }
  return { fixed, details, done: words.length < batchSize }
}

/** Run auto-complete on all incomplete words at once. */
export function autoCompleteAll(): { fixed: number; details: string[] } {
  const db = getDatabase()
  const rows = db.exec(
    `SELECT id, word, phonetic_uk, definition_cn, part_of_speech FROM words
     WHERE phonetic_uk IS NULL OR phonetic_uk = ''
        OR definition_cn IS NULL OR definition_cn = ''
        OR part_of_speech IS NULL OR part_of_speech = ''`
  )
  if (rows.length === 0) return { fixed: 0, details: [] }

  const words = rows[0].values.map(row => {
    const obj: Record<string, unknown> = {}
    rows[0].columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })

  let fixed = 0
  const details: string[] = []
  for (const row of words) {
    const wordId = row.id as number
    const word = (row.word as string).trim()
    const existingDef = ((row.definition_cn as string) || (row.definition_en as string) || '').trim()
    const auto = getAutoComplete(word, existingDef)
    if (!auto.foundInDict && !auto.partOfSpeech) continue
    const sets: string[] = []
    const params: unknown[] = []
    if (auto.phoneticUk) { sets.push('phonetic_uk = ?'); params.push(auto.phoneticUk) }
    if (auto.definitionCn) { sets.push('definition_cn = ?'); params.push(auto.definitionCn) }
    if (auto.partOfSpeech) { sets.push('part_of_speech = ?'); params.push(auto.partOfSpeech) }
    if (sets.length === 0) continue
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(wordId)
    db.run(`UPDATE words SET ${sets.join(', ')} WHERE id = ?`, params)
    fixed++
    const parts: string[] = []
    if (auto.phoneticUk) parts.push('音标')
    if (auto.definitionCn) parts.push('释义')
    if (auto.partOfSpeech) parts.push('词性')
    details.push(`${word}: ${parts.join('、')}${auto.foundInDict ? ' (词典)' : ' (规则推测)'}`)
  }

  return { fixed, details }
}
