import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { TxtParser } from '../../src/main/parser/txt.parser'

const testDir = join(__dirname, '..', '.test-tmp')
const testFile = join(testDir, 'test-words.txt')
if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })

describe('TxtParser', () => {
  let parser: TxtParser

  beforeEach(() => { parser = new TxtParser() })
  afterEach(() => { if (existsSync(testFile)) unlinkSync(testFile) })

  it('should parse one-word-per-line format', async () => {
    writeFileSync(testFile, 'apple\nbook\ncat\ndog\n', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.format).toBe('txt')
    expect(result.headers).toEqual(['word'])
    expect(result.totalRows).toBe(4)
    expect(result.rows[0]).toEqual({ word: 'apple' })
    expect(result.rows[3]).toEqual({ word: 'dog' })
  })

  it('should auto-detect tab-separated format with headers', async () => {
    writeFileSync(testFile, 'word\tphonetic\tdefinition\napple\t/ˈæpəl/\t苹果\nbook\t/bʊk/\t书', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.format).toBe('txt')
    // Headers should be detected from first row
    expect(result.headers.length).toBe(3)
    expect(result.totalRows).toBe(2)
  })

  it('should handle empty files', async () => {
    writeFileSync(testFile, '', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(0)
    expect(result.headers).toEqual([])
  })

  it('should handle files with only whitespace lines', async () => {
    writeFileSync(testFile, '  \n  \n', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(0)
  })

  it('should handle Chinese text files', async () => {
    writeFileSync(testFile, '你好\n世界\n测试\n', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(3)
    expect(result.rows[0]).toEqual({ word: '你好' })
  })

  it('should handle files with tabs and spaces mixed', async () => {
    writeFileSync(testFile, 'apple\t/ˈæpəl/\t苹果\t一种水果\nbanana\t/bəˈnænə/\t香蕉\t一种热带水果', 'utf-8')
    const result = await parser.parse(testFile)
    // 无表头文件：第一行是数据，不能被当成表头剥掉（旧版长度启发式会丢首行）
    expect(result.totalRows).toBe(2)
    expect(result.rows[0]['列1']).toBe('apple')
  })

  it('one-column file with a header row keeps all words', async () => {
    writeFileSync(testFile, '单词\napple\nbook\ncat', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.headers).toEqual(['word'])
    expect(result.totalRows).toBe(3)
    expect(result.rows[0]).toEqual({ word: 'apple' })
  })

  it('one-column file with long words is not misdetected as tab-separated', async () => {
    writeFileSync(testFile, 'internationalization\nuncharacteristically\nmisunderstandings', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(3) // 旧逻辑：平均长度>40 → 误判 tab 格式并丢首词
    expect(result.rows[0].word).toBe('internationalization')
  })

  it('headerless two-column tab file keeps the first row', async () => {
    writeFileSync(testFile, 'apple\t苹果\nbook\t书', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.headers).toEqual(['列1', '列2'])
    expect(result.totalRows).toBe(2)
    expect(result.rows[0]['列1']).toBe('apple')
  })

  it('tab file whose first line has no tab keeps the first line', async () => {
    writeFileSync(testFile, 'apple\nbook\t书\ncat\t猫', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(3)
    expect(result.rows[0]['列1']).toBe('apple')
  })
})
