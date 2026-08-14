import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { initDatabase, getDatabase, closeDatabase } from '../../src/main/database/connection'
import { runMigrations } from '../../src/main/database/migrations'
import {
  refillLevelsBatch, normalizePhoneticsBatch, autoCompleteBatch,
  lookupWord, resetUserDict
} from '../../src/main/validation/autoComplete'
import { saveDictEntry, deleteDictEntry, listDictEntries, undoChange, listChangeLog } from '../../src/main/validation/userDict'
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

  // ============ 用户小词典与修改日志 ============

  it('user dict entry takes priority over ECDICT in lookupWord', () => {
    saveDictEntry({ word: 'apple', phonetic: '/自定义/', definition: 'n. 自定义苹果', pos: 'noun' })
    resetUserDict()
    const e = lookupWord('apple')
    expect(e).not.toBeNull()
    expect(e!.phonetic).toBe('/自定义/')
    expect(e!.definition).toContain('自定义苹果')
  })

  it('saveDictEntry writes a create log; undo removes the entry', () => {
    const before = listChangeLog(1, 50)
    expect(before.rows[0].action).toBe('create')
    expect(before.rows[0].entity_key).toBe('apple')
    // 撤销新增 → 词条消失，大词典命中恢复
    const undo = undoChange(before.rows[0].id as number)
    expect(undo.ok).toBe(true)
    resetUserDict()
    const e = lookupWord('apple')
    expect(e!.phonetic).not.toBe('/自定义/')
    expect(listDictEntries().filter(x => x.word === 'apple').length).toBe(0)
  })

  it('update and delete are logged and undoable', () => {
    saveDictEntry({ word: 'esp.', phonetic: '/esp/', definition: 'abbr. 尤其', pos: 'abbreviation' })
    saveDictEntry({ word: 'esp.', phonetic: '/esp2/', definition: 'abbr. 尤其（改）', pos: 'abbreviation' })
    const log = listChangeLog(1, 50)
    // 最新一条是 update
    expect(log.rows[0].action).toBe('update')
    const undo = undoChange(log.rows[0].id as number)
    expect(undo.ok).toBe(true)
    resetUserDict()
    const e = lookupWord('esp.')
    expect(e!.phonetic).toBe('/esp/')
    // 撤销删除：先删再撤销，词条回来
    deleteDictEntry('esp.')
    const log2 = listChangeLog(1, 50)
    expect(log2.rows[0].action).toBe('delete')
    const undo2 = undoChange(log2.rows[0].id as number)
    expect(undo2.ok).toBe(true)
    resetUserDict()
    expect(lookupWord('esp.')).not.toBeNull()
    // 撤销记录不能再次撤销
    const log3 = listChangeLog(1, 50)
    expect(log3.rows[0].action).toBe('undo')
    expect(undoChange(log3.rows[0].id as number).ok).toBe(false)
  })

  it('autoCompleteBatch uses user dict entries for completion', () => {
    saveDictEntry({ word: 'recommendatio', phonetic: '/ˌrekəmenˈdeɪʃn/', definition: 'n. 推荐（自定义词条）', pos: 'noun' })
    getDatabase().run("INSERT INTO words (word, language) VALUES ('recommendatio', 'en')")
    const res = autoCompleteBatch(10)
    expect(res.fixed).toBeGreaterThanOrEqual(1)
    const rows = getDatabase().exec("SELECT phonetic_uk, definition_cn FROM words WHERE word = 'recommendatio'")
    expect(rows[0].values[0][0]).toBe('/ˌrekəmenˈdeɪʃn/')
    expect(rows[0].values[0][1]).toContain('自定义词条')
  })
})
