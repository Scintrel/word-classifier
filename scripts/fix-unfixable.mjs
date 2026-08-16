/**
 * 修复「词典补全」修不了的问题：
 * 1. 把查不到音标/释义的词写进用户小词典（dict_entries），带完整音标、释义、词性
 * 2. 同时直接把单词表（words）里缺的字段补上
 * 3. 每步都记 change_log（与开发者模式的小词典修改日志格式一致，可撤销）
 *
 * ⚠️ 必须先在应用里退出/关闭应用再运行——应用运行时内存里有一份数据库，
 *    直接改文件会被应用下次保存时覆盖。
 *
 * 用法: node scripts/fix-unfixable.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import initSqlJs from 'sql.js'

// ---------- 0. 安全检查：应用在运行就不动手 ----------
try {
  const out = execSync('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV /NH', { encoding: 'utf8', windowsHide: true })
  if (/electron\.exe/i.test(out)) {
    console.error('⛔ 检测到应用正在运行（electron.exe）。请先关闭应用再运行本脚本，')
    console.error('   否则修改会被应用内存里的旧数据覆盖。')
    process.exit(1)
  }
} catch { /* tasklist 不可用时继续（非 Windows 场景） */ }

const require = createRequire(import.meta.url)
const SQL = await initSqlJs({ locateFile: f => require.resolve('sql.js/dist/' + f) })

// ---------- 1. 要写入小词典的词条（音标/词性/释义均由 Claude 编写，大词典里查不到音标） ----------
// [word, phonetic, pos, definition]
const ENTRIES = [
  ['a.m', '/ˌeɪ ˈem/', 'abbreviation', 'abbr. （拉）午前；早上（ante meridiem）'],
  ['affordable', '/əˈfɔːdəbl/', 'adjective', 'a. 负担得起的；价格合理的'],
  ['air-conditioner', '/ˈeə kənˌdɪʃənə/', 'noun', 'n. 空调器'],
  ['air-conditioning', '/ˈeə kənˌdɪʃənɪŋ/', 'noun', 'n. 空气调节；空调系统'],
  ['appropriately', '/əˈprəʊpriətli/', 'adverb', 'adv. 适当地，恰如其分地'],
  ['axe', '/æks/', 'noun,verb', 'n. 斧，斧头；vt. 削减(人员、经费、计划、机构等)'],
  ['babyboomer', '/ˈbeɪbi ˌbuːmə/', 'noun', 'n. 婴儿潮一代（指二战后生育高峰期出生的人）'],
  ['barracks', '/ˈbærəks/', 'noun', 'n. 兵营，营房；简陋的房子'],
  ['bbq', '/ˌbiːbiːˈkjuː/', 'abbreviation', 'abbr. 野外烧烤（barbecue）；烧烤炉'],
  ['bored', '/bɔːd/', 'adjective', 'a. 无聊的；厌烦的'],
  ['carelessness', '/ˈkeələsnəs/', 'noun', 'n. 粗心大意'],
  ['consistently', '/kənˈsɪstəntli/', 'adverb', 'adv. 始终如一地；一致地'],
  ['cosy', '/ˈkəʊzi/', 'adjective,noun', 'a. 温暖舒适的；n. 保暖套'],
  ['easy-going', '/ˌiːzi ˈɡəʊɪŋ/', 'adjective', 'a. 随和的'],
  ['electronically', '/ɪˌlekˈtrɒnɪkli/', 'adverb', 'adv. 电子地'],
  ['emphasise', '/ˈemfəsaɪz/', 'verb', 'vt. 强调，着重（英式拼写）'],
  ['entitlement', '/ɪnˈtaɪtlmənt/', 'noun', 'n. 权利；资格'],
  ['etc', '/ɪtˈsetərə/', 'abbreviation', '及其他，等等（et cetera）'],
  ['explicitly', '/ɪkˈsplɪsɪtli/', 'adverb', 'adv. 明确地；明白地'],
  ['extensively', '/ɪkˈstensɪvli/', 'adverb', 'adv. 广泛地；大面积地'],
  ['freshman', '/ˈfreʃmən/', 'noun', 'n. 新手；（美）大学一年级学生'],
  ['fulfilment', '/fʊlˈfɪlmənt/', 'noun', 'n. 履行；实现；满足感'],
  ['genetically', '/dʒəˈnetɪkli/', 'adverb', 'adv. 基因上；遗传学上'],
  ['geographically', '/ˌdʒiːəˈɡræfɪkli/', 'adverb', 'adv. 地理上'],
  ['globalise', '/ˈɡləʊbəlaɪz/', 'verb', 'vt. 使全球化（英式拼写）'],
  ['helplessly', '/ˈhelpləsli/', 'adverb', 'adv. 无能为力地；无助地'],
  ['instal', '/ɪnˈstɔːl/', 'verb', 'vt. 安装，设置（英式拼写）'],
  ['intrinsically', '/ɪnˈtrɪnzɪkli/', 'adverb', 'adv. 本质上；固有地'],
  ['ironically', '/aɪˈrɒnɪkli/', 'adverb', 'adv. 讽刺地；令人啼笑皆非地'],
  ['jetlag', '/ˈdʒetlæɡ/', 'noun', 'n. 时差综合症（跨时区飞行后生理节奏的破坏）'],
  ['knowhow', '/ˈnəʊhaʊ/', 'noun', 'n. 实际的能力；专门技术；诀窍'],
  ['laptop', '/ˈlæptɒp/', 'noun', 'n. 笔记本电脑'],
  ['online', '/ˌɒnˈlaɪn/', 'adjective,adverb', 'a. 在线的，联网的；adv. 在线地'],
  ['organisational', '/ˌɔːɡənaɪˈzeɪʃənl/', 'adjective', 'a. 组织上的（英式拼写）'],
  ['p.m', '/ˌpiː ˈem/', 'abbreviation', '下午（post meridiem）'],
  ['panicked', '/ˈpænɪkt/', 'verb', 'vt. 使恐慌（panic 的过去式与过去分词）'],
  ['privatization', '/ˌpraɪvətaɪˈzeɪʃn/', 'noun', 'n. 私有化'],
  ['privatize', '/ˈpraɪvətaɪz/', 'verb', 'vt. 私有化'],
  ['proceedings', '/prəˈsiːdɪŋz/', 'noun', 'n. 诉讼；事项；会议录'],
  ['provisionally', '/prəˈvɪʒənəli/', 'adverb', 'adv. 临时地，暂时地'],
  ['puzzled', '/ˈpʌzld/', 'adjective', 'a. 困惑的，迷惑的'],
  ['remotely', '/rɪˈməʊtli/', 'adverb', 'adv. 远程地；极小地'],
  ['significantly', '/sɪɡˈnɪfɪkəntli/', 'adverb', 'adv. 显著地；意味深长地'],
  ['soundtrack', '/ˈsaʊndtræk/', 'noun', 'n. 声迹；原声带；配乐'],
  ['stressful', '/ˈstresfl/', 'adjective', 'a. 压力大的；紧张的'],
  ['terms', '/tɜːmz/', 'noun', 'n. 条件，条款（term 的复数）'],
  ['thanks', '/θæŋks/', 'noun', 'n. 感谢，谢意；interj. 谢谢'],
  ['unrelated', '/ˌʌnrɪˈleɪtɪd/', 'adjective', 'a. 无关的'],
  ['urgently', '/ˈɜːdʒəntli/', 'adverb', 'adv. 急切地；迫切地'],
  ['vigorously', '/ˈvɪɡərəsli/', 'adverb', 'adv. 有力地；精力充沛地'],
  ['webcast', '/ˈwebkɑːst/', 'noun,verb', 'n. 网络直播；vt. 网络直播'],
  ['website', '/ˈwebsaɪt/', 'noun', 'n. 网站'],
  ['well-off', '/ˌwel ˈɒf/', 'adjective', 'a. 境遇好的，手头宽裕的'],
  ['westerner', '/ˈwestənə/', 'noun', 'n. 西方人，西洋人'],
  ['willingness', '/ˈwɪlɪŋnəs/', 'noun', 'n. 乐意，心甘情愿'],
  ['workforce', '/ˈwɜːkfɔːs/', 'noun', 'n. 劳动力；职工总数'],
  ['wrongly', '/ˈrɒŋli/', 'adverb', 'adv. 错误地，不公正地'],
  // 词性是 unknown（补全时被塞了哨兵值）的常见词——写进小词典后词性可以回填成真实词性
  ['am', '/æm/', 'verb', 'v. be 的第一人称单数现在式'],
  ['caught', '/kɔːt/', 'verb', 'vt. 抓住（catch 的过去式与过去分词）'],
  ['computing', '/kəmˈpjuːtɪŋ/', 'noun', 'n. 计算；计算机科学'],
  ['funding', '/ˈfʌndɪŋ/', 'noun', 'n. 资金；资助'],
  ['has', '/hæz/', 'verb', 'vt. 有（have 的第三人称单数现在式）'],
  ['internet', '/ˈɪntənet/', 'noun', 'n. 互联网'],
]

// ---------- 2. 打开用户数据库 ----------
const dbPath = join(homedir(), 'AppData', 'Roaming', 'word-classifier', 'word-classifier.db')
if (!existsSync(dbPath)) { console.error('找不到用户数据库:', dbPath); process.exit(1) }
const db = new SQL.Database(readFileSync(dbPath))

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql); stmt.bind(params)
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  return row
}

// ---------- 3. 写入小词典 + 修改日志 + 直接修复单词表 ----------
let dictCreated = 0, dictUpdated = 0, wordsFixed = 0, wordsSkipped = 0
const fixedList = []

for (const [word, phonetic, pos, definition] of ENTRIES) {
  // 3a. 小词典 UPSERT（与 userDict.ts 的 saveDictEntry 逻辑一致）
  const old = queryOne('SELECT word, phonetic, definition, pos FROM dict_entries WHERE word = ?', [word])
  const newEntry = { word, phonetic, definition, pos }
  db.run(
    `INSERT INTO dict_entries (word, phonetic, definition, pos, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(word) DO UPDATE SET phonetic = ?, definition = ?, pos = ?, updated_at = CURRENT_TIMESTAMP`,
    [word, phonetic, definition, pos, phonetic, definition, pos]
  )
  db.run(
    'INSERT INTO change_log (entity_type, entity_key, action, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
    ['dict_entry', word, old ? 'update' : 'create',
      old ? JSON.stringify(old) : null, JSON.stringify(newEntry)]
  )
  if (old) dictUpdated++; else dictCreated++

  // 3b. 修复单词表：只填空的字段（绝不覆盖已有内容），词性把 unknown 哨兵替换成真实词性
  const row = queryOne(
    'SELECT id, phonetic_uk, phonetic_us, definition_cn, definition_en, part_of_speech FROM words WHERE word = ?', [word])
  if (!row) { wordsSkipped++; continue }

  const sets = []
  const params = []
  if (!row.phonetic_uk) { sets.push('phonetic_uk = ?'); params.push(phonetic) }
  if (!row.phonetic_us) { sets.push('phonetic_us = ?'); params.push(phonetic) }
  if (!row.definition_cn && !row.definition_en) { sets.push('definition_cn = ?'); params.push(definition) }
  const curPos = String(row.part_of_speech ?? '')
  if (!curPos || curPos === 'unknown') { sets.push('part_of_speech = ?'); params.push(pos) }

  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP')
    params.push(row.id)
    db.run(`UPDATE words SET ${sets.join(', ')} WHERE id = ?`, params)
    wordsFixed++
    fixedList.push(word)
  }
}

// ---------- 4. 保存 ----------
const out = db.export()
writeFileSync(dbPath, Buffer.from(out))
console.log(`小词典新增 ${dictCreated} 条，更新 ${dictUpdated} 条`)
console.log(`单词表直接修复 ${wordsFixed} 个词：${fixedList.join(', ')}`)
if (wordsSkipped > 0) console.log(`跳过 ${wordsSkipped} 个（单词表里没有这个词，只写了小词典）`)
db.close()
