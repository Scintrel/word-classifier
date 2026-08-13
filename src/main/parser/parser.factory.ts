import { type IParser } from './parser.interface'
import { type FileFormat, type ParseResult } from './parser.types'
import { CsvParser } from './csv.parser'
import { ExcelParser } from './excel.parser'
import { TxtParser } from './txt.parser'
import { JsonParser } from './json.parser'
import { PdfParser } from './pdf.parser'

/**
 * 解析器工厂：根据文件扩展名挑选合适的解析器。
 * 你拖进来一个文件，这里负责判断它是 CSV 还是 Excel 还是别的，
 * 然后交给对应的解析器去读内容。
 */
export class ParserFactory {
  // 所有可用的解析器（每新增一种文件格式，就在这里注册一个）
  private static parsers: IParser[] = [
    new CsvParser(),
    new ExcelParser(),
    new TxtParser(),
    new JsonParser(),
    new PdfParser()
  ]

  /** 根据文件扩展名判断格式，不支持的类型返回 null */
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

  /** 找到能处理该文件的解析器；格式不支持时抛出带提示的错误 */
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

  /** 解析文件的统一入口：判断格式 → 交给对应解析器 → 返回结构化数据 */
  static async parse(filePath: string): Promise<ParseResult> {
    const parser = ParserFactory.getParser(filePath)
    return parser.parse(filePath)
  }

  /** 判断文件格式是否被支持（供 IPC 层做文件校验用） */
  static isSupported(filePath: string): boolean {
    return ParserFactory.detectFormat(filePath) !== null
  }
}
