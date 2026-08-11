import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase } from 'sql.js'

let testDb: SqlJsDatabase

// Mock the database connection module before importing code under test
vi.mock('../../src/main/database/connection', () => {
  let _db: SqlJsDatabase | null = null
  return {
    getDatabase: vi.fn(() => {
      if (!_db) throw new Error('DB not initialized')
      return _db
    }),
    saveDatabase: vi.fn(),
    initDatabase: vi.fn(async () => {
      const SQL = await initSqlJs()
      _db = new SQL.Database()
      return _db
    }),
    closeDatabase: () => { _db?.close(); _db = null }
  }
})

describe('Classification Engine', () => {
  beforeAll(async () => {
    const SQL = await initSqlJs()
    testDb = new SQL.Database()

    // Set up the mocked getDatabase to return our test db
    const conn = await import('../../src/main/database/connection')
    vi.mocked(conn.getDatabase).mockReturnValue(testDb)

    // Run migrations on test database
    const { runMigrations } = await import('../../src/main/database/migrations')
    runMigrations(testDb)

    // Insert test words
    const testWords = [
      ['apple', '苹果', 'a round fruit'],
      ['computer', '电脑', 'an electronic device'],
      ['dog', '狗', 'a domestic animal'],
      ['pizza', '披萨', 'Italian food'],
      ['rain', '雨', 'water from clouds'],
      ['happy', '快乐的', 'feeling joy'],
      ['hospital', '医院', 'medical facility'],
      ['guitar', '吉他', 'musical instrument'],
      ['airplane', '飞机', 'flying vehicle'],
      ['president', '总统', 'political leader'],
    ]

    const stmt = testDb.prepare(
      'INSERT INTO words (word, language, definition_cn, definition_en) VALUES (?, ?, ?, ?)'
    )
    for (const [word, cn, en] of testWords) {
      stmt.bind([word, 'en', cn, en])
      stmt.step()
      stmt.reset()
    }
    stmt.free()
  })

  afterAll(() => { testDb.close() })

  it('should classify words into categories', async () => {
    const { classifyAll } = await import('../../src/main/classification/classifier')
    const result = classifyAll()
    expect(result.total).toBe(10)
    expect(result.classified).toBeGreaterThan(0)
    expect(result.details.length).toBeGreaterThan(0)
  })

  it('should assign fruit/food words to appropriate categories', async () => {
    const { classifyAll } = await import('../../src/main/classification/classifier')
    const result = classifyAll()
    // apple and pizza should match Food keywords
    const foodMatches = result.details.filter(d => d.word === 'apple' || d.word === 'pizza')
    expect(foodMatches.length).toBeGreaterThanOrEqual(1)
  })

  it('should have valid confidence scores', async () => {
    const { classifyAll } = await import('../../src/main/classification/classifier')
    const result = classifyAll()
    for (const d of result.details) {
      expect(d.confidence).toBeGreaterThan(0)
      expect(d.confidence).toBeLessThanOrEqual(1.0)
    }
  })

  it('should have matched keywords for each classification', async () => {
    const { classifyAll } = await import('../../src/main/classification/classifier')
    const result = classifyAll()
    for (const d of result.details) {
      expect(d.matchedKeywords.length).toBeGreaterThan(0)
    }
  })
})
