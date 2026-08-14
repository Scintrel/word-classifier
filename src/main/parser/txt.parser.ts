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
   * 只有真的包含制表符才算 tab 分隔——旧版的"平均长度>40"启发式
   * 会把长单词的单列文件误判成 tab 格式，导致第一个单词被当成表头丢掉。
   */
  private detectFormat(lines: string[]): 'one-word-per-line' | 'tab-separated' {
    return lines.some(line => line.includes('\t')) ? 'tab-separated' : 'one-word-per-line'
  }

  /** 纯单词模式里可能出现的表头行（明确命中才剥掉，绝不按长度猜） */
  private static readonly WORD_HEADER_RE = /^(word|words|单词|词汇|vocabulary|wordlist|word list|spelling|拼写)$/i

  /**
   * Parse one-word-per-line format.
   * Creates a single "word" column.
   * 第一行如果明确是表头词（"单词"/"word" 等）才跳过，否则每一行都是单词。
   */
  private parseOneWordPerLine(lines: string[], encoding: string): ParseResult {
    const dataLines = lines.length > 1 && TxtParser.WORD_HEADER_RE.test(lines[0]) ? lines.slice(1) : lines
    const rows = dataLines.map(word => ({ word }))
    return {
      headers: ['word'],
      rows,
      totalRows: rows.length,
      encoding,
      format: 'txt'
    }
  }

  /** tab 文件里可能出现的表头列名 */
  private static readonly TAB_HEADER_RE = /^(word|单词|vocabulary|词汇|phonetic|音标|definition|释义|meaning|意思|example|例句|pos|词性|part|difficulty|难度|level|等级)$/i

  /**
   * Parse tab-separated format.
   * 第一行只有在"有多列"且"列名明确命中表头词"时才视为表头——
   * 旧版的"每列长度≤10"启发式会把无表头文件的第一行数据误当成表头。
   */
  private parseTabSeparated(lines: string[], encoding: string): ParseResult {
    // Split first line to determine column count
    const firstColumns = lines[0].split('\t').map(c => c.trim())
    // 用前 5 行的最大列数做表头数，兼容中间行列数不齐的文件
    const maxCols = Math.max(1, ...lines.slice(0, 5).map(l => l.split('\t').length))

    const looksLikeHeader = firstColumns.length > 1 &&
      firstColumns.some(c => TxtParser.TAB_HEADER_RE.test(c))

    let headers: string[]
    let dataLines: string[]

    if (looksLikeHeader) {
      // 表头列数不足 maxCols 时自动补"列N"，避免后面更宽的数据行丢列
      headers = Array.from({ length: maxCols }, (_, i) => firstColumns[i] ?? `列${i + 1}`)
      dataLines = lines.slice(1)
    } else {
      // Auto-generate headers
      headers = Array.from({ length: maxCols }, (_, i) => `列${i + 1}`)
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
