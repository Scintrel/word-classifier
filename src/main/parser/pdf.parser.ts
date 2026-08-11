import { readFileSync } from 'fs'
import pdfParse from 'pdf-parse'
import { type IParser } from './parser.interface'
import { type FileFormat, type ParseResult } from './parser.types'

/**
 * PDF file parser.
 *
 * PDFs are the hardest format to parse because text extraction is messy:
 * - Page numbers, headers, footers get mixed in
 * - Columns may be space-aligned rather than delimited
 * - Multi-column layouts break reading order
 * - Some PDFs are scanned images with no extractable text
 *
 * Strategy:
 * 1. Extract raw text with pdf-parse
 * 2. Clean noise (page numbers, short lines, PDF artifacts)
 * 3. Detect structure (table vs free-form vs mixed)
 * 4. Parse with appropriate strategy
 * 5. Validate and filter results
 */
export class PdfParser implements IParser {
  readonly format: FileFormat | FileFormat[] = 'pdf'

  async parse(filePath: string): Promise<ParseResult> {
    const buffer = readFileSync(filePath)
    const data = await pdfParse(buffer)
    const rawText = data.text

    if (!rawText || rawText.trim().length === 0) {
      return { headers: [], rows: [], totalRows: 0, format: 'txt' }
    }

    // Step 1: Clean the text
    const cleaned = this.cleanText(rawText)
    if (cleaned.length === 0) {
      return { headers: [], rows: [], totalRows: 0, format: 'txt' }
    }

    // Step 2: Try numbered table first (most common word-list PDF format)
    const numberedResult = this.parseNumberedTable(cleaned)
    if (numberedResult.rows.length >= 3) {
      return {
        headers: numberedResult.headers,
        rows: numberedResult.rows.filter(row => {
          const word = (row.word || '').trim()
          return word.length >= 1 && /[A-Za-z]/.test(word)
        }),
        totalRows: numberedResult.rows.length,
        format: 'txt'
      }
    }

    // Step 3: Detect other structure types
    const structure = this.detectStructure(cleaned)

    let headers: string[]
    let rows: Record<string, string>[]

    if (structure === 'table') {
      const result = this.parseTable(cleaned)
      headers = result.headers
      rows = result.rows
    } else if (structure === 'word-list') {
      const result = this.parseWordList(cleaned)
      headers = result.headers
      rows = result.rows
    } else {
      const tableResult = this.parseTable(cleaned)
      const listResult = this.parseWordList(cleaned)
      if (tableResult.rows.length >= listResult.rows.length) {
        headers = tableResult.headers; rows = tableResult.rows
      } else {
        headers = listResult.headers; rows = listResult.rows
      }
    }

    // Step 4: Filter out rows that don't look like word data
    rows = rows.filter(row => {
      const word = (row.word || row['单词'] || row[Object.keys(row)[0]] || '').trim()
      // A valid word entry should have at least 2 alphabetic characters
      return word.length >= 2 && /[A-Za-z]/.test(word) && !/^\d+$/.test(word)
    })

    return {
      headers,
      rows,
      totalRows: rows.length,
      format: 'txt'
    }
  }

  /**
   * Clean PDF text: remove page numbers, short noise lines, PDF artifacts.
   */
  private cleanText(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => {
        if (line.length === 0) return false
        // Filter out pure page numbers
        if (/^\d{1,4}$/.test(line)) return false
        // Filter out page number patterns like "Page 1" or "- 1 -"
        if (/^(Page\s*\d+|\-\s*\d+\s*\-)$/i.test(line)) return false
        // Filter out very short noise lines (single chars or symbols)
        if (line.length <= 1 && !/[A-Za-z]/.test(line)) return false
        // Filter out lines that are just punctuation
        if (/^[\.\-\—\s]+$/.test(line)) return false
        return true
      })
  }

  /**
   * Parse "numbered table" format — the most common word-list PDF layout.
   * Format: 序号 单词 注音 释义
   *          1 abandon ə'bændən vt.丢弃；放弃
   * Columns separated by single spaces. Use pattern matching per line.
   */
  private parseNumberedTable(lines: string[]): { headers: string[]; rows: Record<string, string>[] } {
    if (lines.length < 2) return { headers: [], rows: [] }

    const headerLine = lines[0]
    const hasNumberedHeader = /^(序号|编号|No\.?|#)\s/i.test(headerLine) ||
      /(序号|编号|单词|注音|音标|释义|词性)/.test(headerLine)

    const dataLines = lines.filter(l => /^\d{1,4}\s+[A-Za-z]/.test(l))
    const numberedRatio = dataLines.length / Math.max(1, lines.length - 1)

    if (!hasNumberedHeader && numberedRatio < 0.3) {
      return { headers: [], rows: [] }
    }

    const rows: Record<string, string>[] = []
    for (const line of dataLines) {
      const parsed = this.parseNumberedLine(line)
      if (parsed) rows.push(parsed)
    }

    let headers: string[]
    if (hasNumberedHeader) {
      const headerTokens = headerLine.split(/\s+/).filter(h => h.length > 0)
      headers = headerTokens.map(h => {
        if (/^(序号|编号|No\.?|#)$/i.test(h)) return '序号'
        if (/^(单词|词汇|word)$/i.test(h)) return 'word'
        if (/^(注音|音标|phonetic|IPA)$/i.test(h)) return 'phonetic'
        if (/^(释义|解释|定义|definition)$/i.test(h)) return 'definition'
        return h
      })
    } else {
      headers = ['word', 'phonetic', 'definition']
    }

    return { headers, rows }
  }

  /**
   * Parse one numbered line: "2 abandon ə'bændən vt.丢弃；放弃；抛弃n.放纵"
   */
  private parseNumberedLine(line: string): Record<string, string> | null {
    const withoutNumber = line.replace(/^\d{1,4}\s+/, '').trim()
    if (!withoutNumber) return null

    // Split into tokens
    const tokens = withoutNumber.split(/\s+/)
    if (tokens.length < 2) return null

    // First token = word (may contain dots like "a.m")
    const word = tokens[0]
    if (!/[A-Za-z]/.test(word)) return null

    // Find where phonetic ends and definition begins
    // Phonetic tokens have IPA chars, no Chinese
    // Definition tokens have Chinese chars or look like POS
    let phoneticIdx = 1
    const phoneticParts: string[] = []
    while (phoneticIdx < tokens.length) {
      const t = tokens[phoneticIdx]
      const hasChinese = /[一-鿿]/.test(t)
      const hasIPA = /[æɑɒɔɛɪʊʌθðʃʒŋə'ˈˌː]/.test(t)
      const looksLikePos = /^[nv]\.?(?:t|i)?\.?$/i.test(t)

      if (hasChinese || (!hasIPA && looksLikePos)) break
      phoneticParts.push(t)
      phoneticIdx++
    }

    const phonetic = phoneticParts.join(' ')
    const definition = tokens.slice(phoneticIdx).join(' ')

    return { word, phonetic, definition }
  }

  /**
   * Detect whether the text is a table, a word list, or mixed.
   */
  private detectStructure(lines: string[]): 'table' | 'word-list' | 'mixed' {
    const sample = lines.slice(0, Math.min(30, lines.length))

    // Count how many lines have consistent multi-column structure
    let tableScore = 0
    let listScore = 0

    for (const line of sample) {
      // Table: has 2+ evenly-spaced columns
      const parts = line.split(/\s{2,}/)
      if (parts.length >= 3 && parts.every(p => p.length > 0)) {
        tableScore += 2
      } else if (parts.length === 2 && parts.every(p => p.length > 0)) {
        tableScore += 1
      }

      // Word list: "word - definition" or "word  definition" patterns
      if (/^[A-Za-z]+[\s\-—–]+.+/.test(line)) {
        listScore += 2
      } else if (/^[A-Za-z]{2,}$/.test(line.trim())) {
        // Single word on a line
        listScore += 1
      }
    }

    if (tableScore > listScore * 1.5) return 'table'
    if (listScore > tableScore * 1.5) return 'word-list'
    return 'mixed'
  }

  /**
   * Parse table-structured PDF text.
   * Lines have columns separated by 2+ spaces or tabs.
   */
  private parseTable(lines: string[]): { headers: string[]; rows: Record<string, string>[] } {
    // Filter to only lines that look like data rows
    const dataLines = lines.filter(line => {
      // Must have at least one alphabetic character (not just numbers/symbols)
      return /[A-Za-z一-鿿]/.test(line)
    })

    if (dataLines.length === 0) return { headers: [], rows: [] }

    // Split all lines by 2+ spaces or tabs
    const splitLines = dataLines.map(line =>
      line.split(/\s{2,}|\t+/).map(c => c.trim()).filter(c => c.length > 0)
    ).filter(parts => parts.length >= 2)

    if (splitLines.length === 0) return { headers: [], rows: [] }

    // Find the most common column count
    const colCounts = new Map<number, number>()
    for (const parts of splitLines) {
      colCounts.set(parts.length, (colCounts.get(parts.length) || 0) + 1)
    }
    const bestColCount = [...colCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0][0]

    // Only keep lines with the expected column count
    const aligned = splitLines.filter(p => p.length === bestColCount)

    // Detect header row
    const maybeHeader = aligned[0]
    const headerPatterns = /^(word|单词|词汇|vocabulary|phonetic|音标|definition|释义|meaning|意思|example|例句|pos|词性|part|difficulty|难度|level|unit|编号|序号|No\.?|#)$/i
    const looksLikeHeader = maybeHeader.some(c => headerPatterns.test(c)) ||
      maybeHeader.every(c => c.length <= 15 && !/\d/.test(c))

    let headers: string[]
    let body: string[][]

    if (looksLikeHeader) {
      headers = maybeHeader
      body = aligned.slice(1)
    } else {
      headers = maybeHeader.map((_, i) => `列${i + 1}`)
      body = aligned
    }

    // If first column consistently contains short alphabetic strings, rename it "word"
    if (!looksLikeHeader && body.length >= 3) {
      const firstCols = body.map(r => r[0] || '')
      const wordLike = firstCols.filter(v => /^[A-Za-z]{2,30}$/.test(v)).length
      if (wordLike >= body.length * 0.6) {
        headers[0] = 'word'
      }
    }

    const rows = body.map(parts => {
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = parts[i] || '' })
      return row
    })

    return { headers, rows }
  }

  /**
   * Parse word-list-structured PDF text.
   * Common patterns:
   * - "word  definition"
   * - "word - definition"
   * - "word /phonetic/ definition"
   * - One word per line
   */
  private parseWordList(lines: string[]): { headers: string[]; rows: Record<string, string>[] } {
    const rows: Record<string, string>[] = []

    for (const line of lines) {
      // Skip lines that are clearly not word entries
      if (line.length < 2) continue
      if (/^[IVX]+\.?\s*$/.test(line)) continue // Roman numerals (section headers)
      if (/^\d+[\.\)]\s/.test(line) && line.length < 6) continue // Numbered list markers only

      // Pattern 1: "word /phonetic/ definition"
      const phoneticMatch = line.match(/^([A-Za-z\-]+)\s+(\/.+?\/)\s+(.+)$/)
      if (phoneticMatch) {
        rows.push({
          word: phoneticMatch[1].trim(),
          phonetic: phoneticMatch[2].trim(),
          definition: phoneticMatch[3].trim()
        })
        continue
      }

      // Pattern 2: "word  definition" (word then definition separated by 2+ spaces)
      const wideSepMatch = line.match(/^([A-Za-z\-]+)\s{2,}(.+)$/)
      if (wideSepMatch && wideSepMatch[1].length >= 2) {
        rows.push({
          word: wideSepMatch[1].trim(),
          definition: wideSepMatch[2].trim()
        })
        continue
      }

      // Pattern 3: "word - definition" or "word — definition"
      const dashMatch = line.match(/^([A-Za-z\-]{2,})\s*[-–—]\s*(.+)$/)
      if (dashMatch) {
        rows.push({
          word: dashMatch[1].trim(),
          definition: dashMatch[2].trim()
        })
        continue
      }

      // Pattern 4: Just a single word (no definition)
      if (/^[A-Za-z\-]{2,}$/.test(line)) {
        rows.push({ word: line.trim() })
        continue
      }

      // Pattern 5: "word definition" (single space separation, but short definition)
      const singleSepMatch = line.match(/^([A-Za-z\-]{3,})\s+(.+)$/)
      if (singleSepMatch && singleSepMatch[2].length > 1) {
        // Only accept if definition looks real (contains letters)
        if (/[A-Za-z一-鿿]/.test(singleSepMatch[2])) {
          rows.push({
            word: singleSepMatch[1].trim(),
            definition: singleSepMatch[2].trim()
          })
          continue
        }
      }

      // Pattern 6: Numbered entry like "1. word  definition"
      const numberedMatch = line.match(/^\d+[\.\)]\s*([A-Za-z\-]{2,})\s*(.*)$/)
      if (numberedMatch) {
        rows.push({
          word: numberedMatch[1].trim(),
          definition: numberedMatch[2].trim() || undefined!
        })
        continue
      }
    }

    // Determine headers from the first row
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []

    return { headers, rows }
  }
}
