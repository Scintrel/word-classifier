import { describe, it, expect } from 'vitest'
import { lookupWord, getAutoComplete } from '../../src/main/validation/autoComplete'

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
      const r = getAutoComplete('xyz')
      expect(r.foundInDict).toBe(false)
      expect(r.partOfSpeech).toBeUndefined()
    })
  })
})
