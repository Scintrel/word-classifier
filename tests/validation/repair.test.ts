import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { initDatabase, getDatabase, closeDatabase } from '../../src/main/database/connection'
import { runMigrations } from '../../src/main/database/migrations'
import {
  refillLevelsBatch, normalizePhoneticsBatch, autoCompleteBatch
} from '../../src/main/validation/autoComplete'
import { validateAllWords } from '../../src/main/validation/validator'

// 测试用数据库文件（electron mock 把 userData 指向 tests/.test-tmp）
const testDbPath = join(__dirname, '..', '.test-tmp', 'word-classifier.db')

/**
 * 检修相关的批量函数测试（连真实数据库模块）。
 * 词典断言值来自 ECDICT 实测：apple tag="zk gk" frq=2695，the frq=1。
 */
describe('Repair functions (DB-backed)', () => {
  beforeAll(async () => {
    // 每次从干净的库开始——上次运行残留的 db 文件会污染测试
    if (existsSync(testDbPath)) unlinkSync(testDbPath)
    const db = await initDatabase()
    runMigrations(db)
  })

  afterAll(() => {
    closeDatabase()
    if (existsSync(testDbPath)) unlinkSync(testDbPath)
  })

  it('refillLevelsBatch fills exam tags and frequency from dictionary', () => {
    getDatabase().run("INSERT INTO words (word, language) VALUES ('apple', 'en')")
    const res = refillLevelsBatch(10)
    expect(res.fixed).toBe(1)
    const rows = getDatabase().exec("SELECT difficulty, frequency FROM words WHERE word = 'apple'")
    expect(rows[0].values[0][0]).toBe('zk,gk')
    expect(rows[0].values[0][1]).toBe(2695)
  })

  it('refillLevelsBatch marks words not in dictionary with none (converges)', () => {
    getDatabase().run("INSERT INTO words (word, language) VALUES ('zzqqxxfake', 'en')")
    const res = refillLevelsBatch(10)
    expect(res.fixed).toBe(1)
    const rows = getDatabase().exec("SELECT difficulty FROM words WHERE word = 'zzqqxxfake'")
    expect(rows[0].values[0][0]).toBe('none')
    // 哨兵值生效：再跑一批不会重新选中它
    const res2 = refillLevelsBatch(10)
    expect(res2.fixed).toBe(0)
    expect(res2.done).toBe(true)
  })

  it('normalizePhoneticsBatch wraps phonetics and converts cyrillic chars', () => {
    getDatabase().run("INSERT INTO words (word, language, phonetic_uk) VALUES ('abandon', 'en', \"ә'bændәn\")")
    const res = normalizePhoneticsBatch(10)
    expect(res.fixed).toBe(1)
    const rows = getDatabase().exec("SELECT phonetic_uk FROM words WHERE word = 'abandon'")
    expect(rows[0].values[0][0]).toBe("/ə'bændən/")
  })

  it('autoCompleteBatch fills both UK and US phonetics', () => {
    // 只填了英式、美式为空的词必须被选中并补全美式
    getDatabase().run("INSERT INTO words (word, language, phonetic_uk) VALUES ('the', 'en', '/ðə/')")
    const res = autoCompleteBatch(10)
    expect(res.fixed).toBeGreaterThanOrEqual(1)
    const rows = getDatabase().exec("SELECT phonetic_uk, phonetic_us FROM words WHERE word = 'the'")
    expect(rows[0].values[0][0]).toBe('/ðə/')
    expect(rows[0].values[0][1]).toBe('/ðə/')
  })

  it('validator flags missing phonetic when only one side is empty', () => {
    getDatabase().run(
      "INSERT INTO words (word, language, phonetic_uk, definition_cn) VALUES ('halfphon', 'en', '/ˈhæf/', '一半音标')"
    )
    const result = validateAllWords()
    const issue = result.issues.find(
      i => i.word === 'halfphon' && i.issueType === 'missing_phonetic'
    )
    expect(issue).toBeDefined()  // 旧逻辑：英式有值 → 不报
    expect(issue!.description).toContain('美式为空')
  })
})
