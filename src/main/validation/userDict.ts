/**
 * 用户小词典（dict_entries 表）与修改日志（change_log 表）的业务逻辑。
 * 开发者模式里维护；小词典优先级高于内置 ECDICT 大词典。
 * 所有写入自动记日志（action: create/update/delete/undo），可撤销。
 */
import { getDatabase, saveDatabase } from '../database/connection'
import { queryAll, queryOne } from '../database/utils'
import { resetUserDict } from './autoComplete'

export interface DictEntryRow {
  word: string
  phonetic: string | null
  definition: string | null
  pos: string | null
}

/** 写入一条修改日志 */
function logChange(action: string, word: string, oldEntry: DictEntryRow | null, newEntry: DictEntryRow | null): void {
  const db = getDatabase()
  db.run(
    'INSERT INTO change_log (entity_type, entity_key, action, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
    ['dict_entry', word, action,
      oldEntry ? JSON.stringify(oldEntry) : null,
      newEntry ? JSON.stringify(newEntry) : null]
  )
}

export function listDictEntries(): DictEntryRow[] {
  const db = getDatabase()
  return queryAll(db, 'SELECT * FROM dict_entries ORDER BY word COLLATE NOCASE') as unknown as DictEntryRow[]
}

/** 新增或更新词条（UPSERT），自动记日志；随后让词典缓失效 */
export function saveDictEntry(entry: { word: string; phonetic?: string; definition?: string; pos?: string }): { ok: boolean; message?: string } {
  const db = getDatabase()
  const word = (entry?.word ?? '').trim()
  if (!word) return { ok: false, message: '词条不能为空' }
  const old = queryOne(db, 'SELECT word, phonetic, definition, pos FROM dict_entries WHERE word = ?', [word]) as DictEntryRow | undefined
  const newEntry: DictEntryRow = {
    word,
    phonetic: entry.phonetic?.trim() || null,
    definition: entry.definition?.trim() || null,
    pos: entry.pos?.trim() || null
  }
  db.run(
    `INSERT INTO dict_entries (word, phonetic, definition, pos, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(word) DO UPDATE SET phonetic = ?, definition = ?, pos = ?, updated_at = CURRENT_TIMESTAMP`,
    [newEntry.word, newEntry.phonetic, newEntry.definition, newEntry.pos,
      newEntry.phonetic, newEntry.definition, newEntry.pos]
  )
  logChange(old ? 'update' : 'create', word, old ?? null, newEntry)
  resetUserDict()
  saveDatabase()
  return { ok: true }
}

export function deleteDictEntry(word: string): { ok: boolean; message?: string } {
  const db = getDatabase()
  const t = (word ?? '').trim()
  const old = queryOne(db, 'SELECT word, phonetic, definition, pos FROM dict_entries WHERE word = ?', [t]) as DictEntryRow | undefined
  if (!old) return { ok: false, message: '词条不存在' }
  db.run('DELETE FROM dict_entries WHERE word = ?', [t])
  logChange('delete', t, old, null)
  resetUserDict()
  saveDatabase()
  return { ok: true }
}

export function listChangeLog(page: number, pageSize: number): {
  rows: Record<string, unknown>[]; total: number; page: number; pageSize: number; totalPages: number
} {
  const db = getDatabase()
  const p = page ?? 1
  const size = pageSize ?? 50
  const total = (queryOne(db, 'SELECT COUNT(*) as total FROM change_log')?.total as number) ?? 0
  const rows = queryAll(db, 'SELECT * FROM change_log ORDER BY id DESC LIMIT ? OFFSET ?', [size, (p - 1) * size])
  return { rows, total, page: p, pageSize: size, totalPages: Math.ceil(total / size) }
}

/** 撤销一条小词典修改：按日志反向恢复；撤销本身也记一条日志 */
export function undoChange(logId: number): { ok: boolean; message?: string } {
  const db = getDatabase()
  const log = queryOne(db, 'SELECT * FROM change_log WHERE id = ?', [logId])
  if (!log) return { ok: false, message: '日志不存在' }
  if (log.entity_type !== 'dict_entry') return { ok: false, message: '该类型暂不支持撤销' }
  if (log.action === 'undo') return { ok: false, message: '撤销记录不能再次撤销' }
  const word = log.entity_key as string
  const oldVal = log.old_value as string | null
  const newVal = log.new_value as string | null

  if (log.action === 'create') {
    // 撤销新增 = 删掉这个词条
    db.run('DELETE FROM dict_entries WHERE word = ?', [word])
  } else if (log.action === 'update') {
    // 撤销更新 = 还原旧值
    if (!oldVal) return { ok: false, message: '日志缺少旧值，无法撤销' }
    const old = JSON.parse(oldVal) as DictEntryRow
    db.run(
      `INSERT INTO dict_entries (word, phonetic, definition, pos, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(word) DO UPDATE SET phonetic = ?, definition = ?, pos = ?, updated_at = CURRENT_TIMESTAMP`,
      [word, old.phonetic ?? null, old.definition ?? null, old.pos ?? null,
        old.phonetic ?? null, old.definition ?? null, old.pos ?? null]
    )
  } else {
    // 撤销删除 = 重建词条
    if (!oldVal) return { ok: false, message: '日志缺少旧值，无法撤销' }
    const old = JSON.parse(oldVal) as DictEntryRow
    db.run(
      'INSERT INTO dict_entries (word, phonetic, definition, pos) VALUES (?, ?, ?, ?)',
      [word, old.phonetic ?? null, old.definition ?? null, old.pos ?? null]
    )
  }
  // 撤销动作本身也记日志，便于追溯
  db.run(
    'INSERT INTO change_log (entity_type, entity_key, action, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
    ['dict_entry', word, 'undo', newVal, oldVal]
  )
  resetUserDict()
  saveDatabase()
  return { ok: true }
}
