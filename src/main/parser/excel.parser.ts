import { readFileSync } from 'fs'
import { read as xlsxRead, utils as xlsxUtils } from 'xlsx'
import { type IParser } from './parser.interface'
import { type FileFormat, type ParseResult } from './parser.types'

/**
 * Excel file parser (.xlsx and .xls).
 * Reads all sheets but primarily processes Sheet 1.
 */
export class ExcelParser implements IParser {
  readonly format: FileFormat | FileFormat[] = ['xlsx', 'xls']

  async parse(filePath: string): Promise<ParseResult> {
    const buffer = readFileSync(filePath)
    const workbook = xlsxRead(buffer, { type: 'buffer' })

    // Use the first sheet (or the one named "Sheet1")
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        format: 'xlsx'
      }
    }

    const sheet = workbook.Sheets[sheetName]

    // Convert to array of objects with header:true
    // First row is treated as column headers
    const data = xlsxUtils.sheet_to_json<Record<string, string>>(sheet, {
      defval: '',           // Default empty cell value
      raw: false,           // Convert all to strings (not dates/numbers)
      blankrows: false      // Skip empty rows
    })

    if (data.length === 0) {
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        format: 'xlsx'
      }
    }

    // Extract headers from the first row's keys
    const headers = Object.keys(data[0])
    const rows = data

    return {
      headers,
      rows,
      totalRows: rows.length,
      format: 'xlsx'
    }
  }
}
