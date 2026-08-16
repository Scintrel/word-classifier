import { getDatabase } from '../database/connection'
import { getAutoComplete, normalizePhonetic } from './autoComplete'

/**
 * Types of validation issues that can be detected.
 */
export type IssueType =
  | 'missing_word'        // Word spelling is empty
  | 'missing_phonetic'    // No phonetic transcription
  | 'missing_definition'  // No definition (neither CN nor EN)
  | 'duplicate_word'      // Same word appears multiple times
  | 'encoding_garbled'    // Possible encoding issue (mojibake)
  | 'phonetic_invalid'    // Phonetic doesn't look like valid IPA
  | 'definition_mismatch' // CN definition looks like English or vice versa
  | 'pos_unknown'         // Part of speech not set

/**
 * A single validation issue found in the data.
 */
export interface ValidationIssue {
  wordId: number
  word: string
  field: string
  issueType: IssueType
  description: string
  currentValue: string | null
  suggestion: string | null
  /** Can this be auto-fixed? */
  autoFixable: boolean
}

/**
 * Validation result containing all issues and summary statistics.
 */
export interface ValidationResult {
  totalWords: number
  checkedAt: string
  stats: {
    complete: number       // Words with no issues
    missingPhonetic: number
    missingDefinition: number
    duplicates: number
    encodingIssues: number
    otherIssues: number
  }
  issues: ValidationIssue[]
}

/**
 * Check if a string contains garbled characters (mojibake).
 * Common sign: mix of Latin chars with unexpected CJK or control characters.
 */
function looksLikeMojibake(text: string): boolean {
  if (!text || text.length < 3) return false

  // Count replacement characters and unusual patterns
  let garbledScore = 0
  const chars = [...text]

  for (const ch of chars) {
    const code = ch.codePointAt(0) ?? 0
    // Unicode replacement character
    if (code === 0xFFFD) garbledScore += 3
    // Control characters (except common whitespace)
    if (code < 0x20 && code !== 0x09 && code !== 0x0A && code !== 0x0D) garbledScore += 2
    // Private use area
    if (code >= 0xE000 && code <= 0xF8FF) garbledScore += 2
  }

  return garbledScore >= 4
}

/**
 * Check if a phonetic string looks like valid IPA.
 * IPA typically contains slashes, special characters like æ, θ, ð, ʃ, ʒ, ŋ, etc.
 * Very basic check: if it has slashes or IPA-specific chars.
 *
 * 兼容 ECDICT 词典的音标风格：
 * - ә / є 是西里尔字母（长得像 ə / ɛ），ECDICT 大量使用
 * - ' 重音符号、, 次重音、: 长音标记
 * - 部分 ECDICT 音标只有普通字母（如 "eik"），只要不含中文/数字/奇怪符号就接受
 */
function looksLikePhonetic(text: string): boolean {
  if (!text || text.length < 2) return false

  // Common IPA patterns（含 ECDICT 变体字符）
  const hasSlashes = /^\/.*\/$/.test(text.trim())
  const hasIpaChars = /[æθðʃʒŋɒɔəәɛєʌɑɪʊɡɜːˈˌ]/.test(text)

  // ECDICT 风格的"轻量音标"：字母 + 重音符号 + 冒号，不含中文和数字
  const isLightPhonetic = /^[a-zA-Zәє',.:\s]+$/.test(text.trim())

  return hasSlashes || hasIpaChars || isLightPhonetic
}

/**
 * Check if Chinese text is actually English (or vice versa).
 */
function isChineseText(text: string): boolean {
  return /[一-鿿]/.test(text)
}

/**
 * Validation engine: scans the entire word database for issues.
 */
export function validateAllWords(): ValidationResult {
  const db = getDatabase()

  // Get all words
  const allWords = db.exec(
    'SELECT id, word, phonetic_uk, phonetic_us, definition_cn, definition_en, part_of_speech FROM words ORDER BY id'
  )

  if (allWords.length === 0) {
    return {
      totalWords: 0,
      checkedAt: new Date().toISOString(),
      stats: {
        complete: 0, missingPhonetic: 0, missingDefinition: 0,
        duplicates: 0, encodingIssues: 0, otherIssues: 0
      },
      issues: []
    }
  }

  const rows = allWords[0].values.map(row => {
    const obj: Record<string, unknown> = {}
    allWords[0].columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })

  const issues: ValidationIssue[] = []

  // Track words for duplicate detection
  // 注意：按拼写完全一致（含大小写）才算重复——China 和 china 是不同的单词
  const wordMap = new Map<string, number[]>()
  for (const row of rows) {
    const word = (row.word as string)?.trim()
    if (!word) continue
    if (!wordMap.has(word)) wordMap.set(word, [])
    wordMap.get(word)!.push(row.id as number)
  }

  // Check each word
  for (const row of rows) {
    const wordId = row.id as number
    const word = (row.word as string)?.trim() ?? ''
    const phoneticUk = (row.phonetic_uk as string)?.trim()
    const phoneticUs = (row.phonetic_us as string)?.trim()
    const defCn = (row.definition_cn as string)?.trim()
    const defEn = (row.definition_en as string)?.trim()
    const pos = (row.part_of_speech as string)?.trim()

    // 与「词典补全」完全一致的查词结果——「可自动修复」标签必须如实：
    // 只有词典里真能查到音标/释义/词性（或后缀规律能推出词性）才算可修，
    // 查不到的标成"需手动处理"，不再骗人说可以自动修。
    const auto = getAutoComplete(word, defCn || defEn || undefined)

    // 1. Missing word
    if (!word) {
      issues.push({
        wordId, word: '(空)', field: 'word',
        issueType: 'missing_word',
        description: '单词拼写为空',
        currentValue: null, suggestion: null,
        autoFixable: false
      })
      continue // Skip further checks for empty words
    }

    // 2. Encoding check
    if (looksLikeMojibake(word)) {
      issues.push({
        wordId, word, field: 'word',
        issueType: 'encoding_garbled',
        description: '单词可能因编码问题显示为乱码',
        currentValue: word, suggestion: '请检查源文件的编码（建议 UTF-8）',
        autoFixable: false
      })
    }
    if (defCn && looksLikeMojibake(defCn)) {
      issues.push({
        wordId, word, field: 'definition_cn',
        issueType: 'encoding_garbled',
        description: '中文释义可能因编码问题显示为乱码',
        currentValue: defCn, suggestion: '请检查源文件的编码（建议 UTF-8）',
        autoFixable: false
      })
    }

    // 3. Missing phonetics（英式或美式任一为空都算问题，描述注明缺哪一侧）
    const missingSide = !phoneticUk && !phoneticUs ? '英式和美式均为空'
      : !phoneticUk ? '英式为空' : !phoneticUs ? '美式为空' : null
    if (missingSide) {
      issues.push({
        wordId, word, field: 'phonetic',
        issueType: 'missing_phonetic',
        description: `缺少音标（${missingSide}）`,
        currentValue: [phoneticUk, phoneticUs].filter(Boolean).join(' / ') || null,
        suggestion: auto.phoneticUk ? null : '内置词典里查不到这个词的音标，可手动编辑，或在开发者模式把它加进小词典',
        autoFixable: Boolean(auto.phoneticUk)
      })
    }

    // 4. Invalid phonetic (if present but doesn't look like IPA)
    if (phoneticUk && phoneticUk.length > 1 && !looksLikePhonetic(phoneticUk)) {
      issues.push({
        wordId, word, field: 'phonetic_uk',
        issueType: 'phonetic_invalid',
        description: '英式音标格式可能不正确',
        currentValue: phoneticUk,
        suggestion: normalizePhonetic(phoneticUk) !== phoneticUk ? '可运行「音标规范化」自动修正' : '音标内容无法自动修正，请手动编辑',
        autoFixable: normalizePhonetic(phoneticUk) !== phoneticUk
      })
    }

    // 5. Missing definitions
    if (!defCn && !defEn) {
      issues.push({
        wordId, word, field: 'definition',
        issueType: 'missing_definition',
        description: '缺少释义（中文和英文均为空）',
        currentValue: null,
        suggestion: auto.definitionCn ? null : '内置词典里查不到这个词的释义，可手动编辑，或在开发者模式把它加进小词典',
        autoFixable: Boolean(auto.definitionCn)
      })
    }

    // 6. Definition language mismatch
    if (defCn && !isChineseText(defCn) && defCn.length > 5) {
      issues.push({
        wordId, word, field: 'definition_cn',
        issueType: 'definition_mismatch',
        description: '中文释义看起来不是中文',
        currentValue: defCn, suggestion: null,
        autoFixable: false
      })
    }
    if (defEn && isChineseText(defEn) && defEn.length > 5) {
      issues.push({
        wordId, word, field: 'definition_en',
        issueType: 'definition_mismatch',
        description: '英文释义看起来是中文',
        currentValue: defEn, suggestion: null,
        autoFixable: false
      })
    }

    // 7. Missing part of speech
    if (!pos) {
      issues.push({
        wordId, word, field: 'part_of_speech',
        issueType: 'pos_unknown',
        description: '词性未设置',
        currentValue: null,
        suggestion: auto.partOfSpeech ? null : '无法从词典或后缀规律推测词性，请手动选择',
        autoFixable: Boolean(auto.partOfSpeech)
      })
    }
  }

  // 8. Duplicate detection
  for (const [lowerWord, ids] of wordMap) {
    if (ids.length > 1) {
      // Report all but the first as duplicates
      for (let i = 1; i < ids.length; i++) {
        issues.push({
          wordId: ids[i], word: lowerWord, field: 'word',
          issueType: 'duplicate_word',
          description: `与 ID ${ids[0]} 重复`,
          currentValue: lowerWord,
          suggestion: `建议保留 ID ${ids[0]}，删除本条`,
          autoFixable: false
        })
      }
    }
  }

  // Calculate stats
  const hasIssues = new Set(issues.map(i => i.wordId))
  const stats = {
    complete: rows.length - hasIssues.size,
    missingPhonetic: issues.filter(i => i.issueType === 'missing_phonetic').length,
    missingDefinition: issues.filter(i => i.issueType === 'missing_definition').length,
    duplicates: issues.filter(i => i.issueType === 'duplicate_word').length,
    encodingIssues: issues.filter(i => i.issueType === 'encoding_garbled').length,
    otherIssues: issues.filter(i =>
      !['missing_phonetic', 'missing_definition', 'duplicate_word', 'encoding_garbled'].includes(i.issueType)
    ).length
  }

  return {
    totalWords: rows.length,
    checkedAt: new Date().toISOString(),
    stats,
    issues
  }
}

/**
 * Run validation and save results to the validation_log table.
 */
export function validateAndLog(): ValidationResult {
  const result = validateAllWords()
  const db = getDatabase()

  // Clear old log and save new issues
  db.run('DELETE FROM validation_log')

  const insertStmt = db.prepare(
    'INSERT INTO validation_log (word_id, field, issue_type, original_value, fixed_value, fixed_by) VALUES (?, ?, ?, ?, ?, ?)'
  )

  for (const issue of result.issues) {
    insertStmt.bind([
      issue.wordId,
      issue.field,
      issue.issueType,
      issue.currentValue ?? '',
      issue.suggestion ?? '',
      'auto'
    ])
    insertStmt.step()
    insertStmt.reset()
  }
  insertStmt.free()

  return result
}
