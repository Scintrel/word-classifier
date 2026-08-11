import { type Database as SqlJsDatabase } from 'sql.js'

export function queryAll(db: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  if (params.length > 0) {
    const stmt = db.prepare(sql)
    try { stmt.bind(params); const r: Record<string, unknown>[] = []; while (stmt.step()) r.push(stmt.getAsObject()); return r }
    finally { stmt.free() }
  }
  const result = db.exec(sql)
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map(row => { const o: Record<string, unknown> = {}; columns.forEach((c, i) => o[c] = row[i]); return o })
}

export function queryOne(db: SqlJsDatabase, sql: string, params: unknown[] = []): Record<string, unknown> | null {
  const rows = queryAll(db, sql, params)
  return rows.length > 0 ? rows[0] : null
}

export function runSQL(db: SqlJsDatabase, sql: string, params: unknown[] = []): void {
  if (params.length > 0) {
    const stmt = db.prepare(sql)
    try { stmt.bind(params); stmt.step() } finally { stmt.free() }
  } else { db.run(sql) }
}
