import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CsvParser } from '../../src/main/parser/csv.parser'

const testDir = join(__dirname, '..', '.test-tmp')
const testFile = join(testDir, 'test-words.csv')

// Ensure test directory exists
if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })

describe('CsvParser', () => {
  let parser: CsvParser

  beforeEach(() => {
    parser = new CsvParser()
  })

  afterEach(() => {
    if (existsSync(testFile)) unlinkSync(testFile)
  })

  it('should parse a simple CSV with headers', async () => {
    const csv = `word,phonetic,definition
apple,/ˈæpəl/,苹果
book,/bʊk/,书
cat,/kæt/,猫`
    writeFileSync(testFile, csv, 'utf-8')

    const result = await parser.parse(testFile)

    expect(result.format).toBe('csv')
    expect(result.headers).toEqual(['word', 'phonetic', 'definition'])
    expect(result.totalRows).toBe(3)
    expect(result.rows[0]).toEqual({ word: 'apple', phonetic: '/ˈæpəl/', definition: '苹果' })
    expect(result.rows[2]).toEqual({ word: 'cat', phonetic: '/kæt/', definition: '猫' })
  })

  it('should handle empty CSV files', async () => {
    writeFileSync(testFile, 'word,phonetic\na,b\n', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(1)
    expect(result.rows[0]).toEqual({ word: 'a', phonetic: 'b' })
  })

  it('should skip empty lines', async () => {
    const csv = `word,definition

apple,苹果

book,书

`
    writeFileSync(testFile, csv, 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(2)
  })

  it('should trim whitespace from headers and values', async () => {
    const csv = ` word ,  phonetic  , definition
 apple , /ˈæpəl/ , 苹果 `
    writeFileSync(testFile, csv, 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.headers).toEqual(['word', 'phonetic', 'definition'])
    expect(result.rows[0].word).toBe('apple')
  })

  it('should handle Chinese headers and content', async () => {
    const csv = `单词,音标,释义
苹果,/ˈæpəl/,一种水果
电脑,/kəmˈpjuːtər/,电子设备`
    writeFileSync(testFile, csv, 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.headers).toEqual(['单词', '音标', '释义'])
    expect(result.totalRows).toBe(2)
    expect(result.rows[0]['单词']).toBe('苹果')
  })

  it('should detect file format', () => {
    expect(parser.format).toBe('csv')
  })

  it('should handle files with many columns', async () => {
    const columns = Array.from({ length: 20 }, (_, i) => `col${i}`)
    const headers = columns.join(',')
    const values = Array.from({ length: 20 }, (_, i) => `val${i}`).join(',')
    writeFileSync(testFile, `${headers}\n${values}`, 'utf-8')

    const result = await parser.parse(testFile)
    expect(result.headers.length).toBe(20)
    expect(result.rows[0]['col0']).toBe('val0')
    expect(result.rows[0]['col19']).toBe('val19')
  })
})
