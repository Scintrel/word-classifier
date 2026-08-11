/**
 * Supported file formats for word list import.
 */
export type FileFormat = 'csv' | 'xlsx' | 'xls' | 'txt' | 'json' | 'pdf'

/**
 * Result of parsing a word list file.
 * Contains the raw data before column mapping.
 */
export interface ParseResult {
  /** Column headers found in the file */
  headers: string[]
  /** All rows as key-value objects (header → cell value) */
  rows: Record<string, string>[]
  /** Total number of data rows */
  totalRows: number
  /** Detected file encoding (for CSV/TXT) */
  encoding?: string
  /** Format of the parsed file */
  format: FileFormat
}

/**
 * User-defined mapping: which column in the file
 * corresponds to which word field in the database.
 */
export interface ColumnMapping {
  /** Column that contains the word/spelling */
  word: string
  /** Column that contains UK phonetic */
  phoneticUk?: string
  /** Column that contains US phonetic */
  phoneticUs?: string
  /** Column that contains Chinese definition */
  definitionCn?: string
  /** Column that contains English definition */
  definitionEn?: string
  /** Column that contains part of speech (noun/verb/adj...) */
  partOfSpeech?: string
  /** Column that contains example sentence in English */
  exampleSentenceEn?: string
  /** Column that contains example sentence Chinese translation */
  exampleSentenceCn?: string
  /** Column that contains difficulty level */
  difficulty?: string
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  /** Number of words successfully imported */
  imported: number
  /** Number of rows skipped (e.g., duplicates) */
  skipped: number
  /** Number of validation warnings */
  warnings: number
  /** List of warning/error messages */
  messages: string[]
  /** ID of the import history record */
  importId: number
}
