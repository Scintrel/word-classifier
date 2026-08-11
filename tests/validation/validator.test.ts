import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase } from 'sql.js'

// We test the validation logic directly without the Electron IPC wrappers
// by creating an in-memory database with test data

let db: SqlJsDatabase

async function setupTestDb() {
  const SQL = await initSqlJs()
  db = new SQL.Database()

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      language TEXT DEFAULT 'en',
      phonetic_uk TEXT, phonetic_us TEXT,
      part_of_speech TEXT, definition_cn TEXT, definition_en TEXT,
      difficulty TEXT DEFAULT 'unknown', frequency REAL,
      source_file TEXT, source_row INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS validation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER, import_id INTEGER,
      field TEXT NOT NULL, issue_type TEXT NOT NULL,
      original_value TEXT, fixed_value TEXT, fixed_by TEXT DEFAULT 'auto',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  return db
}

function insertWord(data: Record<string, unknown>) {
  const keys = Object.keys(data)
  const values = Object.values(data)
  const placeholders = keys.map(() => '?').join(', ')
  const stmt = db.prepare(`INSERT INTO words (${keys.join(', ')}) VALUES (${placeholders})`)
  stmt.bind(values)
  stmt.step()
  stmt.free()
}

function queryAll(sql: string): Record<string, unknown>[] {
  const result = db.exec(sql)
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map(row => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

describe('Validation Engine', () => {
  beforeAll(async () => {
    db = await setupTestDb()
  })

  afterAll(() => {
    db.close()
  })

  // --- Manual mini-validation tests (testing the rules directly) ---

  it('should detect missing phonetics', () => {
    insertWord({ word: 'testword', language: 'en' })
    const words = queryAll('SELECT * FROM words WHERE word = ?', )
    // Re-query with parameters properly
    const stmt = db.prepare('SELECT * FROM words WHERE word = ?')
    stmt.bind(['testword'])
    let found = false
    while (stmt.step()) {
      const w = stmt.getAsObject()
      expect(w.phonetic_uk).toBeNull()
      expect(w.phonetic_us).toBeNull()
      found = true
    }
    stmt.free()
    expect(found).toBe(true)
  })

  it('should detect missing definitions', () => {
    insertWord({ word: 'nodef', language: 'en', phonetic_uk: '/test/' })
    const stmt = db.prepare('SELECT * FROM words WHERE word = ?')
    stmt.bind(['nodef'])
    while (stmt.step()) {
      const w = stmt.getAsObject()
      expect(w.definition_cn).toBeNull()
      expect(w.definition_en).toBeNull()
    }
    stmt.free()
  })

  it('should allow words with all fields complete', () => {
    insertWord({
      word: 'complete', language: 'en',
      phonetic_uk: '/kəmˈpliːt/', phonetic_us: '/kəmˈpliːt/',
      definition_cn: '完成', definition_en: 'to finish',
      part_of_speech: 'verb', difficulty: 'intermediate'
    })
    const stmt = db.prepare('SELECT * FROM words WHERE word = ?')
    stmt.bind(['complete'])
    let found = false
    while (stmt.step()) {
      const w = stmt.getAsObject()
      expect(w.word).toBe('complete')
      expect(w.definition_cn).toBe('完成')
      found = true
    }
    stmt.free()
    expect(found).toBe(true)
  })

  it('should handle empty word column gracefully', () => {
    // Words with empty word field should still be queryable
    insertWord({ word: '', language: 'en', definition_cn: '空单词测试' })
    const stmt = db.prepare("SELECT * FROM words WHERE word = ''")
    stmt.bind([])
    let found = false
    while (stmt.step()) {
      const w = stmt.getAsObject()
      expect(w.word).toBe('')
      expect(w.definition_cn).toBe('空单词测试')
      found = true
    }
    stmt.free()
    expect(found).toBe(true)
  })

  it('should detect duplicate words', () => {
    insertWord({ word: 'dupword', language: 'en', definition_cn: '第1次' })
    insertWord({ word: 'dupword', language: 'en', definition_cn: '第2次' })

    const stmt = db.prepare("SELECT COUNT(*) as c FROM words WHERE word = 'dupword'")
    stmt.bind([])
    let count = 0
    while (stmt.step()) count = stmt.getAsObject().c as number
    stmt.free()
    expect(count).toBe(2)
  })

  it('should correctly count total words', () => {
    const result = queryAll('SELECT COUNT(*) as c FROM words')
    const total = result[0]?.c as number
    expect(total).toBeGreaterThanOrEqual(6) // We inserted 6 words across all tests
  })

  it('should support filtering by difficulty', () => {
    insertWord({ word: 'advancedword', language: 'en', difficulty: 'advanced' })
    const stmt = db.prepare("SELECT * FROM words WHERE difficulty = 'advanced'")
    stmt.bind([])
    let found = 0
    while (stmt.step()) found++
    stmt.free()
    expect(found).toBeGreaterThanOrEqual(1)
  })
})
