import { ipcMain, dialog } from 'electron'
import { getDatabase, saveDatabase } from '../database/connection'
import { queryAll, queryOne, runSQL } from '../database/utils'
import { ParserFactory } from '../parser/parser.factory'
import { type ColumnMapping } from '../parser/parser.types'
import { validateAndLog } from '../validation/validator'
import { autoCompleteCount, autoCompleteBatch } from '../validation/autoComplete'
import { classifyAll, getClassificationStats } from '../classification/classifier'
import { createAIService, type AIConfig } from '../ai/aiService'

// Wrap runSQL to auto-save after writes
const runSQLWithSave = (sql: string, params: unknown[] = []) => { runSQL(getDatabase(), sql, params); saveDatabase() }
const queryAll_ = (sql: string, params?: unknown[]) => queryAll(getDatabase(), sql, params)
const queryOne_ = (sql: string, params?: unknown[]) => queryOne(getDatabase(), sql, params)

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
      where += ' AND w.id IN (SELECT word_id FROM word_categories WHERE category_id = ?)'
      params.push(options.categoryId)
    }

    if (options?.difficulty && options.difficulty !== 'all') {
      where += ' AND w.difficulty = ?'
      params.push(options.difficulty)
    }

    const countResult = queryOne_(
      `SELECT COUNT(*) as total FROM words w ${where}`,
      params
    )
    const total = (countResult?.total as number) ?? 0

    const words = queryAll_(
      `SELECT w.*, GROUP_CONCAT(c.name_cn, ', ') as categories
       FROM words w
       LEFT JOIN word_categories wc ON w.id = wc.word_id
       LEFT JOIN categories c ON wc.category_id = c.id
       ${where}
       GROUP BY w.id
       ORDER BY w.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
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
  // Words: get all distinct difficulties for filter dropdown
  // ============================================
  ipcMain.handle('words:getDifficulties', () => {
    return queryAll_('SELECT DISTINCT difficulty FROM words WHERE difficulty IS NOT NULL ORDER BY difficulty')
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
      const difficulty = mapping.difficulty ? row[mapping.difficulty]?.trim() || 'unknown' : 'unknown'
      const exampleEn = mapping.exampleSentenceEn ? row[mapping.exampleSentenceEn]?.trim() || null : null
      const exampleCn = mapping.exampleSentenceCn ? row[mapping.exampleSentenceCn]?.trim() || null : null

      // Insert word —— 循环内用 runSQL（不写盘），全部导入完成后统一 saveDatabase 一次，
      // 否则每个单词都要把整个数据库导出写盘一次，导入 5 万词会慢到不可用
      runSQL(getDatabase(),
        `INSERT INTO words (word, language, phonetic_uk, phonetic_us, part_of_speech,
          definition_cn, definition_en, difficulty, source_file, source_row)
         VALUES (?, 'en', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          word, phoneticUk, phoneticUs, partOfSpeech,
          definitionCn, definitionEn, difficulty,
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
  }) => {
    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (options?.categoryId) {
      where += ' AND w.id IN (SELECT word_id FROM word_categories WHERE category_id = ?)'
      params.push(options.categoryId)
    }
    if (options?.difficulty && options.difficulty !== 'all') {
      where += ' AND w.difficulty = ?'
      params.push(options.difficulty)
    }

    const words = queryAll_(
      `SELECT w.word, w.phonetic_uk, w.phonetic_us, w.part_of_speech,
              w.definition_cn, w.definition_en, w.difficulty,
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
    saveDatabase()
    // Re-run category seed migration
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
      const stmt = db.prepare(
        `UPDATE words SET phonetic_uk = ?, phonetic_us = ?, definition_cn = ?,
         definition_en = ?, part_of_speech = ?, difficulty = ?, updated_at = CURRENT_TIMESTAMP
         WHERE word = ? AND language = 'en'`
      )
      for (const r of results) {
        if (!r.word) continue
        stmt.bind([r.phoneticUk, r.phoneticUs, r.definitionCn, r.definitionEn, r.partOfSpeech, r.difficulty, r.word])
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
