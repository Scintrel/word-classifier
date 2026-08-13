import { type Database as SqlJsDatabase } from 'sql.js'

/**
 * 查询多行数据。
 * 返回对象数组：每一行变成 { 列名: 值 } 形式，方便直接读取。
 * 例：queryAll(db, 'SELECT id, word FROM words') → [{ id: 1, word: 'apple' }, ...]
 *
 * 带参数时必须用占位符 ? + params 数组（参数化查询，防止 SQL 注入），
 * 千万不要自己拼接 SQL 字符串。
 */
export function queryAll(db: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  if (params.length > 0) {
    // 有参数：走 prepared statement（先编译 SQL，再绑定参数执行）
    const stmt = db.prepare(sql)
    try {
      stmt.bind(params)
      const r: Record<string, unknown>[] = []
      while (stmt.step()) r.push(stmt.getAsObject())
      return r
    } finally {
      stmt.free()
    }
  }
  // 无参数：直接执行
  const result = db.exec(sql)
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map(row => {
    const o: Record<string, unknown> = {}
    columns.forEach((c, i) => { o[c] = row[i] })
    return o
  })
}

/**
 * 查询单行数据。查到返回对象，查不到返回 null。
 * 适合"查一个单词是否存在"这类场景。
 */
export function queryOne(db: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown> | null {
  const rows = queryAll(db, sql, params)
  return rows.length > 0 ? rows[0] : null
}

/**
 * 执行写操作（INSERT / UPDATE / DELETE）。
 * 注意：sql.js 是内存数据库，本函数只改内存，不写磁盘——
 * 需要持久化时调用方要在合适时机调 saveDatabase()。
 */
export function runSQL(db: SqlJsDatabase, sql: string, params: unknown[] = []): void {
  if (params.length > 0) {
    const stmt = db.prepare(sql)
    try {
      stmt.bind(params)
      stmt.step()
    } finally {
      stmt.free()
    }
  } else {
    db.run(sql)
  }
}
