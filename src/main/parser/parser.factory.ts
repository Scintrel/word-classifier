import { type IParser } from './parser.interface'
import { type FileFormat, type ParseResult } from './parser.types'
import { CsvParser } from './csv.parser'
import { ExcelParser } from './excel.parser'
import { TxtParser } from './txt.parser'
import { JsonParser } from './json.parser'
import { PdfParser } from './pdf.parser'

export class ParserFactory {
  private static parsers: IParser[] = [
    new CsvParser(),
    new ExcelParser(),
    new TxtParser(),
    new JsonParser(),
    new PdfParser()
  ]

  static detectFormat(filePath: string): FileFormat | null {
    const ext = filePath.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'csv': return 'csv'
      case 'xlsx': return 'xlsx'
      case 'xls': return 'xls'
      case 'txt': return 'txt'
      case 'json': return 'json'
      case 'pdf': return 'pdf'
      default: return null
    }
  }

  static getParser(filePath: string): IParser {
    const format = ParserFactory.detectFormat(filePath)
    if (!format) {
      throw new Error(
        `不支持的文件格式: ${filePath}\n` +
        '支持的格式: CSV, Excel (.xlsx/.xls), TXT, JSON, PDF'
      )
    }
    const parser = ParserFactory.parsers.find(p => {
      if (Array.isArray(p.format)) return p.format.includes(format)
      return p.format === format
    })
    if (!parser) {
      throw new Error(`找不到处理 ${format} 格式的解析器`)
    }
    return parser
  }

  static async parse(filePath: string): Promise<ParseResult> {
    const parser = ParserFactory.getParser(filePath)
    return parser.parse(filePath)
  }

  static isSupported(filePath: string): boolean {
    return ParserFactory.detectFormat(filePath) !== null
  }

  static getSupportedExtensions(): string[] {
    return ['csv', 'xlsx', 'xls', 'txt', 'json', 'pdf']
  }
}
