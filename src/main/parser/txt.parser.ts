import { readFileSync } from 'fs'
import { detect } from 'jschardet'
import { type IParser } from './parser.interface'
import { type FileFormat, type ParseResult } from './parser.types'

/**
 * Plain text file parser.
 *
 * Supports three common word-list formats:
 * 1. One word per line (headerless)
 * 2. Tab-separated: word \t definition
 * 3. Multiple spaces: word    definition    example
 */
export class TxtParser implements IParser {
  readonly format: FileFormat | FileFormat[] = 'txt'

  async parse(filePath: string): Promise<ParseResult> {
    // Read and detect encoding
    const buffer = readFileSync(filePath)
    const detection = detect(buffer)
    const encoding = detection.encoding ?? 'utf-8'
    const text = new TextDecoder(encoding).decode(buffer)

    // Split into non-empty lines
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (lines.length === 0) {
      return { headers: [], rows: [], totalRows: 0, encoding, format: 'txt' }
    }

    // Detect the format by analyzing the first few lines
    const sample = lines.slice(0, Math.min(5, lines.length))
    const format = this.detectFormat(sample)

    let headers: string[]
    let rows: Record<string, string>[]

    switch (format) {
      case 'tab-separated':
        return this.parseTabSeparated(lines, encoding)

      case 'one-word-per-line':
      default:
        return this.parseOneWordPerLine(lines, encoding)
    }
  }

  /**
   * Detect whether the file is tab-separated or one-word-per-line.
   */
  private detectFormat(lines: string[]): 'one-word-per-line' | 'tab-separated' {
    // If any of the first lines contain a tab, treat as tab-separated
    const hasTabs = lines.some(line => line.includes('\t'))
    if (hasTabs) return 'tab-separated'

    // If lines are very long with multiple spaces, likely tab/space separated
    // (but using spaces instead of tabs)
    const avgLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length
    if (avgLength > 40) return 'tab-separated'

    return 'one-word-per-line'
  }

  /**
   * Parse one-word-per-line format.
   * Creates a single "word" column.
   */
  private parseOneWordPerLine(lines: string[], encoding: string): ParseResult {
    const rows = lines.map(word => ({ word }))
    return {
      headers: ['word'],
      rows,
      totalRows: rows.length,
      encoding,
      format: 'txt'
    }
  }

  /**
   * Parse tab-separated format.
   * First non-empty line is treated as the header row if it looks like headers,
   * otherwise auto-generates column names.
   */
  private parseTabSeparated(lines: string[], encoding: string): ParseResult {
    // Split first line to determine column count
    const firstColumns = lines[0].split('\t').map(c => c.trim())

    // Decide if first row looks like a header
    // Headers are typically short (1-5 chars) and contain common field names
    const looksLikeHeader = firstColumns.some(
      c => /^(word|单词|vocabulary|词汇|phonetic|音标|definition|释义|meaning|意思|example|例句|pos|词性|part|difficulty|难度|level)$/i.test(c)
    ) || firstColumns.every(c => c.length <= 10)

    let headers: string[]
    let dataLines: string[]

    if (looksLikeHeader) {
      headers = firstColumns
      dataLines = lines.slice(1)
    } else {
      // Auto-generate headers
      headers = firstColumns.map((_, i) => `列${i + 1}`)
      dataLines = lines
    }

    const rows = dataLines.map(line => {
      const cols = line.split('\t').map(c => c.trim())
      const row: Record<string, string> = {}
      headers.forEach((header, i) => {
        row[header] = cols[i] ?? ''
      })
      return row
    })

    return {
      headers,
      rows,
      totalRows: rows.length,
      encoding,
      format: 'txt'
    }
  }
}
