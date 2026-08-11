import { readFileSync } from 'fs'
import { parse } from 'papaparse'
import { detect } from 'jschardet'
import { type IParser } from './parser.interface'
import { type FileFormat, type ParseResult } from './parser.types'

/**
 * CSV file parser.
 * Handles comma-separated, tab-separated, and other delimiter formats.
 * Auto-detects file encoding to handle both UTF-8 and GB2312 files.
 */
export class CsvParser implements IParser {
  readonly format: FileFormat | FileFormat[] = 'csv'

  async parse(filePath: string): Promise<ParseResult> {
    // Read raw bytes for encoding detection
    const buffer = readFileSync(filePath)
    const detection = detect(buffer)
    const encoding = detection.encoding ?? 'utf-8'

    // Decode with detected encoding
    const text = new TextDecoder(encoding).decode(buffer)

    // Parse CSV with papaparse
    const result = parse(text, {
      header: true,           // First row = column headers
      skipEmptyLines: true,   // Ignore blank lines
      transformHeader: (h: string) => h.trim(),  // Remove whitespace around headers
      transform: (v: string) => v.trim(),         // Remove whitespace around values
      encoding: 'utf-8'
    })

    if (result.errors.length > 0) {
      console.warn('CSV parse warnings:', result.errors)
    }

    const headers = result.meta.fields ?? []
    const rows = result.data as Record<string, string>[]

    return {
      headers,
      rows,
      totalRows: rows.length,
      encoding,
      format: 'csv'
    }
  }
}
