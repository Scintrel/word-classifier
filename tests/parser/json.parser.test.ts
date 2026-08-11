import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { JsonParser } from '../../src/main/parser/json.parser'

const testDir = join(__dirname, '..', '.test-tmp')
const testFile = join(testDir, 'test-words.json')
if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })

describe('JsonParser', () => {
  let parser: JsonParser
  beforeEach(() => { parser = new JsonParser() })
  afterEach(() => { if (existsSync(testFile)) unlinkSync(testFile) })

  it('should parse array of word objects', async () => {
    const data = JSON.stringify([
      { word: 'apple', phonetic: '/ˈæpəl/', definition: '苹果' },
      { word: 'book', phonetic: '/bʊk/', definition: '书' }
    ])
    writeFileSync(testFile, data, 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.headers).toContain('word')
    expect(result.totalRows).toBe(2)
    expect(result.rows[0].word).toBe('apple')
  })

  it('should parse object with "words" key', async () => {
    const data = JSON.stringify({ words: [{ word: 'hello' }, { word: 'world' }] })
    writeFileSync(testFile, data, 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(2)
  })

  it('should handle empty array', async () => {
    writeFileSync(testFile, '[]', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(0)
  })

  it('should handle single object', async () => {
    writeFileSync(testFile, '{ "word": "solo" }', 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.totalRows).toBe(1)
  })

  it('should convert non-string values to strings', async () => {
    const data = JSON.stringify([{ word: 'one', count: 1, active: true }])
    writeFileSync(testFile, data, 'utf-8')
    const result = await parser.parse(testFile)
    expect(result.rows[0].count).toBe('1')
    expect(result.rows[0].active).toBe('true')
  })
})
