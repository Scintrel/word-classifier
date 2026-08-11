import { readFileSync } from 'fs'
import { type IParser } from './parser.interface'
import { type FileFormat, type ParseResult } from './parser.types'

/**
 * JSON file parser.
 *
 * Supports two JSON structures:
 * 1. Array of objects: [{"word": "apple", "definition": "苹果"}, ...]
 * 2. Object with a "words" key: {"words": [...]}
 */
export class JsonParser implements IParser {
  readonly format: FileFormat | FileFormat[] = 'json'

  async parse(filePath: string): Promise<ParseResult> {
    const text = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(text)

    // Normalize to an array of objects
    let items: Record<string, unknown>[]

    if (Array.isArray(data)) {
      items = data
    } else if (data.words && Array.isArray(data.words)) {
      items = data.words
    } else if (data.data && Array.isArray(data.data)) {
      items = data.data
    } else if (typeof data === 'object' && data !== null) {
      // Single object → wrap in array
      items = [data as Record<string, unknown>]
    } else {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        format: 'json'
      }
    }

    // Extract all unique keys as headers
    const headerSet = new Set<string>()
    for (const item of items) {
      Object.keys(item).forEach(k => headerSet.add(k))
    }
    const headers = Array.from(headerSet)

    // Convert values to strings
    const rows = items.map(item => {
      const row: Record<string, string> = {}
      for (const key of headers) {
        const value = item[key]
        row[key] = value === null || value === undefined ? '' : String(value)
      }
      return row
    })

    return {
      headers,
      rows,
      totalRows: rows.length,
      format: 'json'
    }
  }
}
