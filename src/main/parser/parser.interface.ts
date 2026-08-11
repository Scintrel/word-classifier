import { type FileFormat, type ParseResult } from './parser.types'

/**
 * Interface that all file parsers must implement.
 * Each format (CSV, Excel, TXT, JSON) gets its own parser class.
 */
export interface IParser {
  /** The file format this parser handles */
  readonly format: FileFormat | FileFormat[]

  /**
   * Parse a file and return structured data.
   * @param filePath - Absolute path to the file
   * @returns Parsed data with headers and rows
   */
  parse(filePath: string): Promise<ParseResult>
}
