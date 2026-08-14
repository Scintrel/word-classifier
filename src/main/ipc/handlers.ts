import { ipcMain, dialog } from 'electron'
import { getDatabase, saveDatabase } from '../database/connection'
import { queryAll, queryOne, runSQL } from '../database/utils'
import { ParserFactory } from '../parser/parser.factory'
import { type ColumnMapping } from '../parser/parser.types'
import { validateAndLog } from '../validation/validator'
import {
  autoCompleteCount, autoCompleteBatch, lookupWord,
  normalizePhoneticsCount, normalizePhoneticsBatch,
  refillLevelsCount, refillLevelsBatch
} from '../validation/autoComplete'
import { classifyAll, getClassificationStats } from '../classification/classifier'
import { createAIService, type AIConfig } from '../ai/aiService'

// Wrap runSQL to auto-save after writes
const runSQLWithSave = (sql: string, params: unknown[] = []) => { runSQL(getDatabase(), sql, params); saveDatabase() }
const queryAll_ = (sql: string, params?: unknown[]) => queryAll(getDatabase(), sql, params)
const queryOne_ = (sql: string, params?: unknown[]) => queryOne(getDatabase(), sql, params)

// 词频档位区间（COCA 词频排名：数字越小越常用）。
// ⚠️ 渲染端 src/renderer/constants/wordMeta.ts 的 freqBand() 保持同一套数值。
const FREQ_BAND_RANGES: Record<string, [number, number]> = {
  top: [1, 1000],
  high: [1001, 3000],
  mid: [3001, 8000],
  low: [8001, 20000],
  rare: [20001, Number.MAX_SAFE_INTEGER]
}

/**
 * Register all IPC handlers — the communication bridge between UI and backend.
 */
export function registerIpcHandlers(): void {
  // ============================================
  // File dialog
  // ============================================
  ipcMain.handle('dialog:openFile', async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showOpenDialog({
      title: '选择单词表文件',
      properties: ['openFile'],
      filters: options?.filters ?? [
        { name: '所有支持的格式', extensions: ['csv', 'xlsx', 'xls', 'txt', 'json', 'pdf'] },
        { name: 'CSV 文件', extensions: ['csv'] },
        { name: 'Excel 文件', extensions: ['xlsx', 'xls'] },
        { name: '文本文件', extensions: ['txt'] },
        { name: 'JSON 文件', extensions: ['json'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ============================================
  // App info
  // ============================================
  ipcMain.handle('app:getVersion', () => '1.0.0')
  ipcMain.handle('app:getPlatform', () => process.platform)

  // ============================================
  // Word statistics
  // ============================================
  ipcMain.handle('words:getStats', () => {
    const totalWords = queryOne_('SELECT COUNT(*) as count FROM words')
    const totalCategories = queryOne_('SELECT COUNT(*) as count FROM categories')
    const totalExamples = queryOne_('SELECT COUNT(*) as count FROM examples')
    const lastImport = queryOne_(
      'SELECT file_name, imported_at FROM import_history ORDER BY imported_at DESC LIMIT 1'
    )

    return {
      totalWords: totalWords?.count ?? 0,
      totalCategories: totalCategories?.count ?? 0,
      totalExamples: totalExamples?.count ?? 0,
      lastImport: lastImport ?? null
    }
  })

  // ============================================
  // Categories: get all
  // ============================================
  ipcMain.handle('categories:getAll', () => {
    return queryAll_(
      `SELECT c.*, COUNT(wc.word_id) as word_count
       FROM categories c
       LEFT JOIN word_categories wc ON c.id = wc.category_id
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    )
  })

  // ============================================
  // Words: list with pagination, search, filters
  // ============================================
  ipcMain.handle('words:list', (_event, options?: {
    page?: number
    pageSize?: number
    search?: string
    categoryId?: number
    difficulty?: string
    frequency?: string
    partOfSpeech?: string
  }) => {
    const page = options?.page ?? 1
    const pageSize = options?.pageSize ?? 50
    const offset = (page - 1) * pageSize

    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (options?.search) {
      where += ' AND (w.word LIKE ? OR w.definition_cn LIKE ? OR w.definition_en LIKE ?)'
      const s = `%${options.search}%`
      params.push(s, s, s)
    }

    if (options?.categoryId) {
      // 11 = 未分类：筛选"没有任何分类"的单词（这些词在 word_categories 表里没有记录）
      if (options.categoryId === 11) {
        where += ' AND w.id NOT IN (SELECT word_id FROM word_categories)'
      } else {
        // 选中根分类时自动包含它的全部子分类（子分类没有下级，等价于精确匹配）
        where += ` AND w.id IN (SELECT word_id FROM word_categories
                   WHERE category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?))`
        params.push(options.categoryId, options.categoryId)
      }
    }

    // 等级筛选：difficulty 存逗号连接的考试标签（如 "gk,cet4,cet6"），无标签为 'none'
    if (options?.difficulty === 'other') {
      where += " AND (w.difficulty IS NULL OR w.difficulty = '' OR w.difficulty = 'unknown' OR w.difficulty = 'none')"
    } else if (options?.difficulty && options.difficulty !== 'all') {
      where += " AND (',' || w.difficulty || ',') LIKE ?"
      params.push(`%,${options.difficulty},%`)
    }

    // 词频筛选：按 COCA 排名区间
    if (options?.frequency && options.frequency !== 'all') {
      if (options.frequency === 'none') {
        where += ' AND (w.frequency IS NULL OR w.frequency = 0)'
      } else {
        const range = FREQ_BAND_RANGES[options.frequency]
        where += ' AND w.frequency >= ? AND w.frequency <= ?'
        params.push(range[0], range[1])
      }
    }

    // 词性筛选：一词多词性时逗号连接存储，用首尾加逗号避免误匹配（"verb" 不会命中 "adverb"... 等）
    if (options?.partOfSpeech && options.partOfSpeech !== 'all') {
      where += " AND (',' || w.part_of_speech || ',') LIKE ?"
      params.push(`%,${options.partOfSpeech},%`)
    }

    const countResult = queryOne_(
      `SELECT COUNT(*) as total FROM words w ${where}`,
      params
    )
    const total = (countResult?.total as number) ?? 0

    // 搜索时的排序参数单独追加到列表查询里（计数查询不需要），且必须在 LIMIT/OFFSET 之前
    const listParams = [...params]
    let orderBy = 'w.updated_at DESC'
    if (options?.search) {
      // 完全匹配 → 前缀匹配 → 其余包含；同级按词频（越常用越靠前），再按 id
      orderBy = `CASE WHEN LOWER(w.word) = LOWER(?) THEN 0
                 WHEN LOWER(w.word) LIKE LOWER(?) || '%' THEN 1
                 ELSE 2 END,
                 COALESCE(w.frequency, 999999), w.id`
      listParams.push(options.search, options.search)
    }

    const words = queryAll_(
      `SELECT w.*, GROUP_CONCAT(c.name_cn || '|' || COALESCE(c.color, ''), '||') as category_badges
       FROM words w
       LEFT JOIN word_categories wc ON w.id = wc.word_id
       LEFT JOIN categories c ON wc.category_id = c.id
       ${where}
       GROUP BY w.id
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...listParams, pageSize, offset]
    )

    return {
      words,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  })

  // ============================================
  // Words: get single word with examples
  // ============================================
  ipcMain.handle('words:getOne', (_event, wordId: number) => {
    const word = queryOne_('SELECT * FROM words WHERE id = ?', [wordId])
    if (!word) return null

    const examples = queryAll_('SELECT * FROM examples WHERE word_id = ?', [wordId])
    const categories = queryAll_(
      `SELECT c.* FROM categories c
       JOIN word_categories wc ON c.id = wc.category_id
       WHERE wc.word_id = ?`,
      [wordId]
    )

    return { word, examples, categories }
  })

  // ============================================
  // Words: update a word's fields
  // ============================================
  ipcMain.handle('words:update', (_event, wordId: number, updates: Record<string, unknown>) => {
    const allowedFields = [
      'word', 'phonetic_uk', 'phonetic_us', 'part_of_speech',
      'definition_cn', 'definition_en', 'difficulty'
    ]

    const sets: string[] = []
    const params: unknown[] = []

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sets.push(`${key} = ?`)
        params.push(value)
      }
    }

    if (sets.length === 0) return false

    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(wordId)

    runSQLWithSave(`UPDATE words SET ${sets.join(', ')} WHERE id = ?`, params)
    return true
  })

  // ============================================
  // Words: delete a word (and cascade to examples/relations)
  // ============================================
  ipcMain.handle('words:delete', (_event, wordId: number) => {
    // Foreign keys with ON DELETE CASCADE handle related records
    runSQLWithSave('DELETE FROM words WHERE id = ?', [wordId])
    return true
  })

  // ============================================
  // Words: add an example sentence to a word
  // ============================================
  ipcMain.handle('words:addExample', (_event, wordId: number, sentenceEn: string, sentenceCn?: string) => {
    runSQLWithSave(
      'INSERT INTO examples (word_id, sentence_en, sentence_cn) VALUES (?, ?, ?)',
      [wordId, sentenceEn, sentenceCn ?? null]
    )
    return true
  })

  // ============================================
  // Words: delete an example sentence
  // ============================================
  ipcMain.handle('words:deleteExample', (_event, exampleId: number) => {
    runSQLWithSave('DELETE FROM examples WHERE id = ?', [exampleId])
    return true
  })

  // ============================================
  // Words: update word-category associations
  // ============================================
  ipcMain.handle('words:setCategories', (_event, wordId: number, categoryIds: number[]) => {
    // Remove existing associations
    runSQLWithSave('DELETE FROM word_categories WHERE word_id = ? AND is_manual = 1', [wordId])

    // Add new ones
    for (const catId of categoryIds) {
      runSQLWithSave(
        'INSERT OR IGNORE INTO word_categories (word_id, category_id, is_manual) VALUES (?, ?, 1)',
        [wordId, catId]
      )
    }
    return true
  })

  // ============================================
  // Import: parse a file and return preview data
  // ============================================
  ipcMain.handle('import:parseFile', async (_event, filePath: string) => {
    // 安全校验：只接受支持的文件格式，防止界面被攻破后读取任意文件
    if (!ParserFactory.isSupported(filePath)) {
      throw new Error('不支持的文件格式，仅支持 CSV / Excel / TXT / JSON / PDF')
    }
    const result = await ParserFactory.parse(filePath)
    // Only return first 20 rows for preview
    return {
      headers: result.headers,
      previewRows: result.rows.slice(0, 20),
      totalRows: result.totalRows,
      encoding: result.encoding,
      format: result.format
    }
  })

  // ============================================
  // Import: run the actual import with column mapping
  // ============================================
  ipcMain.handle('import:runImport', async (_event, filePath: string, mapping: ColumnMapping) => {
    const db = getDatabase()
    // 安全校验：同 parseFile，拒绝不支持的格式
    if (!ParserFactory.isSupported(filePath)) {
      throw new Error('不支持的文件格式，仅支持 CSV / Excel / TXT / JSON / PDF')
    }
    const parseResult = await ParserFactory.parse(filePath)

    // Create import history record
    runSQLWithSave(
      `INSERT INTO import_history (file_name, file_path, file_format, rows_total, rows_imported)
       VALUES (?, ?, ?, ?, 0)`,
      [
        filePath.split(/[/\\]/).pop() ?? filePath,
        filePath,
        parseResult.format,
        parseResult.totalRows
      ]
    )

    // Get the last inserted row ID
    const lastId = queryOne_('SELECT last_insert_rowid() as id')
    const historyId = (lastId?.id as number) ?? 0

    let imported = 0
    let skipped = 0
    const messages: string[] = []

    for (const row of parseResult.rows) {
      const word = row[mapping.word]?.trim()
      if (!word || word.length === 0) {
        skipped++
        continue
      }

      // Check for duplicate
      const existing = queryOne_('SELECT id FROM words WHERE word = ? AND language = ?', [word, 'en'])
      if (existing) {
        skipped++
        messages.push(`跳过重复: ${word}`)
        continue
      }

      // Extract values from the mapped columns
      const phoneticUk = mapping.phoneticUk ? row[mapping.phoneticUk]?.trim() || null : null
      const phoneticUs = mapping.phoneticUs ? row[mapping.phoneticUs]?.trim() || null : null
      const definitionCn = mapping.definitionCn ? row[mapping.definitionCn]?.trim() || null : null
      const definitionEn = mapping.definitionEn ? row[mapping.definitionEn]?.trim() || null : null
      const partOfSpeech = mapping.partOfSpeech ? row[mapping.partOfSpeech]?.trim() || null : null
      const exampleEn = mapping.exampleSentenceEn ? row[mapping.exampleSentenceEn]?.trim() || null : null
      const exampleCn = mapping.exampleSentenceCn ? row[mapping.exampleSentenceCn]?.trim() || null : null

      // 等级与词频：文件里有对应列就用文件的，没有就从词典推导，查不到存 'none'
      const dictEntry = lookupWord(word)
      const mappedDifficulty = mapping.difficulty ? row[mapping.difficulty]?.trim() || '' : ''
      const difficulty = mappedDifficulty
        || (dictEntry?.tag ? dictEntry.tag.split(/\s+/).filter(Boolean).join(',') : 'none')
      const frequency = (dictEntry?.frq != null && dictEntry.frq > 0) ? dictEntry.frq : null

      // Insert word —— 循环内用 runSQL（不写盘），全部导入完成后统一 saveDatabase 一次，
      // 否则每个单词都要把整个数据库导出写盘一次，导入 5 万词会慢到不可用
      runSQL(getDatabase(),
        `INSERT INTO words (word, language, phonetic_uk, phonetic_us, part_of_speech,
          definition_cn, definition_en, difficulty, frequency, source_file, source_row)
         VALUES (?, 'en', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          word, phoneticUk, phoneticUs, partOfSpeech,
          definitionCn, definitionEn, difficulty, frequency,
          filePath.split(/[/\\]/).pop() ?? filePath,
          imported + skipped
        ]
      )

      // Get the newly inserted word ID
      const wordIdResult = queryOne_('SELECT last_insert_rowid() as id')
      const wordId = (wordIdResult?.id as number) ?? 0

      // Insert example sentence if provided
      if (exampleEn && wordId > 0) {
        runSQL(getDatabase(),
          'INSERT INTO examples (word_id, sentence_en, sentence_cn) VALUES (?, ?, ?)',
          [wordId, exampleEn, exampleCn]
        )
      }

      imported++
    }

    // Update import history with actual counts
    runSQL(getDatabase(),
      'UPDATE import_history SET rows_imported = ?, rows_skipped = ? WHERE id = ?',
      [imported, skipped, historyId]
    )

    // 整个导入流程只写盘这一次
    saveDatabase()

    return {
      imported,
      skipped,
      warnings: 0,
      messages: messages.slice(0, 10), // Only return first 10 messages
      importId: historyId
    }
  })

  // ============================================
  // Import: get import history
  // ============================================
  ipcMain.handle('import:getHistory', () => {
    return queryAll_(
      'SELECT * FROM import_history ORDER BY imported_at DESC LIMIT 20'
    )
  })

  // ============================================
  // Validation: scan all words for issues
  // ============================================
  ipcMain.handle('validation:check', () => {
    return validateAndLog()
  })

  // ============================================
  // Validation: auto-complete missing fields
  // ============================================
  ipcMain.handle('validation:autoFixCount', () => {
    return autoCompleteCount()
  })

  ipcMain.handle('validation:autoFixBatch', (_event, batchSize?: number) => {
    const result = autoCompleteBatch(batchSize || 200)
    saveDatabase()
    return result
  })

  // ============================================
  // Validation: 音标规范化（存量音标补 // 与修正特殊字符）
  // ============================================
  ipcMain.handle('validation:normalizePhoneticsCount', () => {
    return normalizePhoneticsCount()
  })

  ipcMain.handle('validation:normalizePhoneticsBatch', (_event, batchSize?: number) => {
    const result = normalizePhoneticsBatch(batchSize || 300)
    saveDatabase()
    return result
  })

  // ============================================
  // Validation: 等级/词频回填（词典 tag/frq → difficulty/frequency）
  // ============================================
  ipcMain.handle('validation:refillLevelsCount', () => {
    return refillLevelsCount()
  })

  ipcMain.handle('validation:refillLevelsBatch', (_event, batchSize?: number) => {
    const result = refillLevelsBatch(batchSize || 300)
    saveDatabase()
    return result
  })

  // ============================================
  // Classification: auto-classify all unclassified words
  // ============================================
  ipcMain.handle('classification:run', () => {
    const result = classifyAll()
    return result
  })

  // ============================================
  // Classification: get stats
  // ============================================
  ipcMain.handle('classification:stats', () => {
    return getClassificationStats()
  })

  // ============================================
  // Export: export words to JSON (for CSV/Excel, handled in renderer)
  // ============================================
  ipcMain.handle('export:words', (_event, options?: {
    categoryId?: number
    difficulty?: string
    frequency?: string
  }) => {
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (options?.categoryId) {
      // 11 = 未分类：筛选"没有任何分类"的单词（这些词在 word_categories 表里没有记录）
      if (options.categoryId === 11) {
        where += ' AND w.id NOT IN (SELECT word_id FROM word_categories)'
      } else {
        where += ` AND w.id IN (SELECT word_id FROM word_categories
                   WHERE category_id = ? OR category_id IN (SELECT id FROM categories WHERE parent_id = ?))`
        params.push(options.categoryId, options.categoryId)
      }
    }
    // 等级筛选：与 words:list 同一套语义
    if (options?.difficulty === 'other') {
      where += " AND (w.difficulty IS NULL OR w.difficulty = '' OR w.difficulty = 'unknown' OR w.difficulty = 'none')"
    } else if (options?.difficulty && options.difficulty !== 'all') {
      where += " AND (',' || w.difficulty || ',') LIKE ?"
      params.push(`%,${options.difficulty},%`)
    }
    // 词频筛选：与 words:list 同一套区间
    if (options?.frequency && options.frequency !== 'all') {
      if (options.frequency === 'none') {
        where += ' AND (w.frequency IS NULL OR w.frequency = 0)'
      } else {
        const range = FREQ_BAND_RANGES[options.frequency]
        where += ' AND w.frequency >= ? AND w.frequency <= ?'
        params.push(range[0], range[1])
      }
    }

    const words = queryAll_(
      `SELECT w.word, w.phonetic_uk, w.phonetic_us, w.part_of_speech,
              w.definition_cn, w.definition_en, w.difficulty, w.frequency,
              GROUP_CONCAT(c.name_cn, ', ') as categories
       FROM words w
       LEFT JOIN word_categories wc ON w.id = wc.word_id
       LEFT JOIN categories c ON wc.category_id = c.id
       ${where}
       GROUP BY w.id
       ORDER BY w.word`,
      params
    )

    // Also get examples for each word
    const enrichedWords = words.map((w: Record<string, unknown>) => {
      const examples = queryAll_(
        'SELECT sentence_en, sentence_cn FROM examples WHERE word_id = (SELECT id FROM words WHERE word = ? LIMIT 1)',
        [w.word]
      )
      return { ...w, examples }
    })

    return enrichedWords
  })

  // ============================================
  // Data management: clear all words
  // ============================================
  ipcMain.handle('data:clearWords', () => {
    const db = getDatabase()
    // Delete all data (foreign keys cascade handle related records)
    db.run('DELETE FROM word_categories')
    db.run('DELETE FROM word_relations')
    db.run('DELETE FROM examples')
    db.run('DELETE FROM validation_log')
    db.run('DELETE FROM import_history')
    db.run('DELETE FROM words')
    saveDatabase()
    return true
  })

  // ============================================
  // Data management: reset categories to defaults
  // ============================================
  ipcMain.handle('data:resetCategories', () => {
    const db = getDatabase()
    db.run('DELETE FROM word_categories')
    db.run('DELETE FROM categories')
    // ⚠️ 必须清空迁移记录再重跑——否则 runMigrations 认为种子迁移已执行过，
    // 直接跳过，重置后 categories 表就是空的
    db.run('DELETE FROM _migrations')
    saveDatabase()
    // Re-run all migrations (CREATE TABLE IF NOT EXISTS + 分类种子 + 调色板)
    const { runMigrations } = require('../database/migrations')
    runMigrations(db)
    return true
  })

  // ============================================
  // AI: get current config
  // ============================================
  function getAIConfig(): AIConfig {
    const provider = (queryOne_('SELECT value FROM settings WHERE key = ?', ['ai_provider'])?.value as string) || 'ollama'
    const ollamaUrl = (queryOne_('SELECT value FROM settings WHERE key = ?', ['ai_ollama_url'])?.value as string) || 'http://localhost:11434'
    const apiKey = (queryOne_('SELECT value FROM settings WHERE key = ?', ['ai_api_key'])?.value as string) || ''
    const model = (queryOne_('SELECT value FROM settings WHERE key = ?', ['ai_model'])?.value as string) || ''
    return { provider: provider as 'ollama' | 'deepseek', ollamaUrl, apiKey, model }
  }

  ipcMain.handle('ai:testConnection', async () => {
    const ai = createAIService(getAIConfig())
    return ai.testConnection()
  })

  ipcMain.handle('ai:saveConfig', (_event, config: Record<string, string>) => {
    const db = getDatabase()
    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP'
    )
    for (const [k, v] of Object.entries(config)) {
      upsert.bind([`ai_${k}`, v, v])
      upsert.step()
      upsert.reset()
    }
    upsert.free()
    saveDatabase()
    return true
  })

  ipcMain.handle('ai:getConfig', () => ({
    provider: (queryOne_('SELECT value FROM settings WHERE key = ?', ['ai_provider'])?.value as string) || 'ollama',
    ollamaUrl: (queryOne_('SELECT value FROM settings WHERE key = ?', ['ai_ollama_url'])?.value as string) || 'http://localhost:11434',
    apiKey: (queryOne_('SELECT value FROM settings WHERE key = ?', ['ai_api_key'])?.value as string) || '',
    model: (queryOne_('SELECT value FROM settings WHERE key = ?', ['ai_model'])?.value as string) || '',
  }))

  ipcMain.handle('ai:completeWord', async (_event, word: string) => {
    const ai = createAIService(getAIConfig())
    return ai.completeWord(word)
  })

  ipcMain.handle('ai:completeWordsBatch', async (_event, words: string[]) => {
    const ai = createAIService(getAIConfig())
    return ai.completeWordsBatch(words)
  })

  ipcMain.handle('ai:autoFillCount', () => {
    return queryOne_(
      `SELECT COUNT(*) as c FROM words WHERE language = 'en'
       AND (phonetic_uk IS NULL OR phonetic_uk = ''
         OR definition_cn IS NULL OR definition_cn = ''
         OR part_of_speech IS NULL OR part_of_speech = '')`
    )?.c as number ?? 0
  })

  ipcMain.handle('ai:autoFillAll', async (_event, batchSize?: number) => {
    const db = getDatabase()
    const size = batchSize || 10
    const rows = queryAll_(
      `SELECT word FROM words WHERE language = 'en'
       AND (phonetic_uk IS NULL OR phonetic_uk = ''
         OR definition_cn IS NULL OR definition_cn = ''
         OR part_of_speech IS NULL OR part_of_speech = '')
       ORDER BY id LIMIT ?`,
      [size]
    )
    if (rows.length === 0) return { filled: 0, words: [], done: true }
    const words = rows.map(r => r.word as string)
    const ai = createAIService(getAIConfig())
    const results = await ai.completeWordsBatch(words)

    let filled = 0
    if (results.length > 0) {
      // 难度已改为等级标签+词频体系，AI 不再写 difficulty（等级/词频只来自词典）
      const stmt = db.prepare(
        `UPDATE words SET phonetic_uk = ?, phonetic_us = ?, definition_cn = ?,
         definition_en = ?, part_of_speech = ?, updated_at = CURRENT_TIMESTAMP
         WHERE word = ? AND language = 'en'`
      )
      for (const r of results) {
        if (!r.word) continue
        stmt.bind([r.phoneticUk, r.phoneticUs, r.definitionCn, r.definitionEn, r.partOfSpeech, r.word])
        stmt.step()
        stmt.reset()
        if (r.examples.length > 0) {
          const exStmt = db.prepare('INSERT INTO examples (word_id, sentence_en, sentence_cn) SELECT id, ?, ? FROM words WHERE word = ? AND language = ?')
          for (const ex of r.examples) {
            if (ex.en) { exStmt.bind([ex.en, ex.cn || '', r.word, 'en']); exStmt.step(); exStmt.reset() }
          }
          exStmt.free()
        }
        filled++
      }
      stmt.free()
      saveDatabase()
    }
    return { filled, words: results.map(r => r.word), done: words.length < size }
  })

  ipcMain.handle('ai:classifyWord', async (_event, word: string, definition: string) => {
    const ai = createAIService(getAIConfig())
    return ai.classifyWord(word, definition)
  })

  // ============================================
  // Settings
  // ============================================
  ipcMain.handle('settings:get', (_event, key: string) => {
    const row = queryOne_('SELECT value FROM settings WHERE key = ?', [key])
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    runSQLWithSave(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
      [key, value, value]
    )
    return true
  })

  ipcMain.handle('settings:getAll', () => {
    const rows = queryAll_('SELECT key, value FROM settings')
    const result: Record<string, string> = {}
    for (const row of rows) {
      result[row.key as string] = row.value as string
    }
    return result
  })
}
