import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs'

let SQL: SqlJsStatic | null = null
let db: SqlJsDatabase | null = null
let dbPath: string

/**
 * Get the path to the database file.
 */
function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }
  return join(userDataPath, 'word-classifier.db')
}

/**
 * Initialize the SQLite database using sql.js (pure JS, no native deps).
 * sql.js compiles SQLite to WebAssembly — it works on Windows, Mac, and Linux
 * without any build tools.
 */
export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db

  // Initialize sql.js WASM runtime
  SQL = await initSqlJs()

  dbPath = getDbPath()

  // Load existing database file, or create a new one
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // Enable WAL-like behavior isn't available in sql.js, but we can
  // enable foreign keys
  db.run('PRAGMA foreign_keys = ON')

  return db
}

/**
 * Save the in-memory database to disk.
 * sql.js keeps the entire database in memory, so we need to
 * explicitly write it to disk to persist changes.
 *
 * 原子写入：先写到临时文件再改名，避免写入中途断电/崩溃导致数据库文件损坏
 */
export function saveDatabase(): void {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  const tmpPath = dbPath + '.tmp'
  writeFileSync(tmpPath, buffer)
  renameSync(tmpPath, dbPath)
}

/**
 * Get the current database instance.
 */
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
  }
}
