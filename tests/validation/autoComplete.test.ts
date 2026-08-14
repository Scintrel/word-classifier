import { describe, it, expect } from 'vitest'
import { lookupWord, getAutoComplete, normalizePhonetic } from '../../src/main/validation/autoComplete'

describe('AutoComplete', () => {
  describe('lookupWord', () => {
    it('should find apple in dictionary', () => {
      const e = lookupWord('apple')
      expect(e).not.toBeNull()
      expect(e!.word).toBe('apple')
      expect(e!.phonetic).toBeTruthy()
      expect(e!.definition).toBeTruthy()
    })
    it('should be case insensitive', () => {
      expect(lookupWord('APPLE')).not.toBeNull()
    })
    it('should trim whitespace', () => {
      expect(lookupWord('  apple  ')).not.toBeNull()
    })
    it('should return null for unknown words', () => {
      expect(lookupWord('xyznonexistent123')).toBeNull()
    })
  })

  describe('getAutoComplete', () => {
    it('should return dict data for apple', () => {
      const r = getAutoComplete('apple')
      expect(r.foundInDict).toBe(true)
      expect(r.phoneticUk).toBeTruthy()
      expect(r.definitionCn).toBeTruthy()
    })
    it('should guess noun from -ness suffix', () => {
      expect(getAutoComplete('happiness').partOfSpeech).toBe('noun')
    })
    it('should guess adjective from -able suffix', () => {
      expect(getAutoComplete('unbelievable').partOfSpeech).toBe('adjective')
    })
    it('should guess adverb from -ly suffix', () => {
      expect(getAutoComplete('quickly').partOfSpeech).toBe('adverb')
    })
    it('should guess verb from -ize suffix', () => {
      expect(getAutoComplete('modernize').partOfSpeech).toBe('verb')
    })
    it('should return empty for unknown short word', () => {
      // 用乱造的单词（完整 ECDICT 词典里连 xyz 都有，改用真正不存在的词）
      const r = getAutoComplete('zzqqxx')
      expect(r.foundInDict).toBe(false)
      expect(r.partOfSpeech).toBeUndefined()
    })
    it('should expose exam tags and COCA frequency for apple', () => {
      const r = getAutoComplete('apple')
      expect(r.difficultyTags).toContain('zk')
      expect(r.difficultyTags).toContain('gk')
      expect(r.frq).toBe(2695)
    })
    it('should wrap phonetics in slashes and normalize cyrillic chars', () => {
      const r = getAutoComplete('apple')
      expect(r.phoneticUk).toMatch(/^\/.*\/$/)
      expect(r.phoneticUk).not.toMatch(/[әє]/)
      expect(r.phoneticUs).toBe(r.phoneticUk)
    })
  })

  describe('normalizePhonetic', () => {
    it('converts ECDICT cyrillic chars and wraps in slashes', () => {
      expect(normalizePhonetic("ә'bændәn")).toBe("/ə'bændən/")
    })
    it('keeps already-wrapped phonetics', () => {
      expect(normalizePhonetic('/əbændən/')).toBe('/əbændən/')
    })
    it('leaves non-phonetic text untouched', () => {
      expect(normalizePhonetic('你好世界')).toBe('你好世界')
    })
    it('returns null for empty input', () => {
      expect(normalizePhonetic(null)).toBeNull()
      expect(normalizePhonetic(undefined)).toBeNull()
      expect(normalizePhonetic('')).toBeNull()
      expect(normalizePhonetic('   ')).toBeNull()
    })
  })
})
