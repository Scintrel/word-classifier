import { getDatabase, saveDatabase } from '../database/connection'
import { CATEGORY_KEYWORDS, type CategoryKeywords } from './keywords'

interface ClassificationResult {
  wordId: number
  word: string
  categoryId: number
  categoryName: string
  confidence: number
  matchedKeywords: string[]
}

/**
 * 关键词匹配：英文关键词按整词匹配（避免 art 匹配到 cart），
 * 中文关键词直接包含匹配。
 */
function keywordMatch(text: string, kw: string): boolean {
  if (/[一-鿿]/.test(kw)) {
    return text.includes(kw)
  }
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i')
  return re.test(text)
}

/**
 * Classify a single word by matching against category keywords.
 *
 * Strategy:
 * 1. 英文关键词匹配单词本身和英文释义（整词匹配）
 * 2. 中文关键词匹配中文释义（词典补全后的释义是中文）
 * 3. Score each category by number of keyword matches
 * 4. 多分类：一个词可以分给多个类——分数 >= 2 的类全部保留（最多 3 个），
 *    若没有任何类达到 2 分，则只取分数最高的 1 个类
 * 5. Confidence is based on match count vs total keywords checked
 */
function classifyWord(
  wordId: number,
  word: string,
  definitionCn: string | null,
  definitionEn: string | null
): ClassificationResult[] {
  const wordLower = word.toLowerCase().trim()
  const defCnLower = (definitionCn ?? '').toLowerCase()
  const defEnLower = (definitionEn ?? '').toLowerCase()

  // 英文关键词的搜索范围：单词 + 英文释义
  const searchTextEn = `${wordLower} ${defEnLower}`

  // 收集所有有匹配的分类（不再只取最高分的 1 个）
  const matches: { cat: CategoryKeywords; score: number; subId: number | null; matched: string[] }[] = []

  for (const cat of CATEGORY_KEYWORDS) {
    // Reset per-category state to prevent leaking between categories
    let catSubId: number | null = null
    let catSubMatched: string[] = []

    // 英文关键词：匹配单词和英文释义（整词）
    const rootMatches = cat.keywords.filter(kw =>
      keywordMatch(searchTextEn, kw)
    )
    // 中文关键词：匹配中文释义
    const cnMatches = cat.cnKeywords.filter(kw => defCnLower.includes(kw))
    let score = rootMatches.length + cnMatches.length

    // Check sub-categories（英文整词 + 中文包含）
    let subScore = 0
    if (cat.subCategories) {
      for (const sub of cat.subCategories) {
        const subMatches = [
          ...sub.keywords.filter(kw => keywordMatch(searchTextEn, kw)),
          ...sub.cnKeywords.filter(kw => defCnLower.includes(kw))
        ]
        if (subMatches.length > subScore) {
          subScore = subMatches.length
          catSubId = sub.id
          catSubMatched = subMatches
        }
      }
    }

    score += subScore

    if (score > 0) {
      matches.push({ cat, score, subId: subScore > 0 ? catSubId : null, matched: [...rootMatches, ...cnMatches, ...catSubMatched] })
    }
  }

  if (matches.length === 0) return []

  // 按分数从高到低排序
  matches.sort((a, b) => b.score - a.score)

  // 多分类规则：分数 >= 2 的全部保留（最多 3 个）；没有 >= 2 的只取最高 1 个
  const selected = matches.filter(m => m.score >= 2).slice(0, 3)
  if (selected.length === 0) selected.push(matches[0])

  return selected.map(m => {
    // Determine which category ID to assign (子分类优先，否则用主分类)
    const assignedCategoryId = m.subId ?? m.cat.categoryId
    // Calculate confidence (0.3–1.0 range)
    const confidence = Math.min(1.0, 0.3 + m.score * 0.15)
    return {
      wordId,
      word,
      categoryId: assignedCategoryId,
      categoryName: '',
      confidence: Math.round(confidence * 100) / 100,
      matchedKeywords: m.matched.slice(0, 5)
    }
  })
}

/**
 * Classify all unclassified words in the database.
 * Only classifies words that don't already have manual category assignments.
 */
export function classifyAll(): { classified: number; total: number; details: ClassificationResult[] } {
  const db = getDatabase()

  // Get all words that are NOT manually categorized
  const rows = db.exec(
    `SELECT w.id, w.word, w.definition_cn, w.definition_en
     FROM words w
     WHERE w.id NOT IN (
       SELECT DISTINCT word_id FROM word_categories WHERE is_manual = 1
     )
     ORDER BY w.id`
  )

  if (rows.length === 0) {
    return { classified: 0, total: 0, details: [] }
  }

  const words = rows[0].values.map(row => {
    const obj: Record<string, unknown> = {}
    rows[0].columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })

  let classified = 0
  const details: ClassificationResult[] = []

  // Prepare statements
  const deleteAuto = db.prepare(
    'DELETE FROM word_categories WHERE word_id = ? AND is_manual = 0'
  )
  const insert = db.prepare(
    'INSERT OR IGNORE INTO word_categories (word_id, category_id, confidence, is_manual) VALUES (?, ?, ?, 0)'
  )

  for (const row of words) {
    const wordId = row.id as number
    const word = (row.word as string).trim()
    const defCn = (row.definition_cn as string) ?? null
    const defEn = (row.definition_en as string) ?? null

    // 先清掉旧的自动分类（无匹配的词也要清——否则旧规则的结果会残留，
    // 重跑分类后结果与当前关键词规则不一致）
    deleteAuto.bind([wordId])
    deleteAuto.step()
    deleteAuto.reset()

    // 一个词可能命中多个分类，返回结果是数组
    const results = classifyWord(wordId, word, defCn, defEn)

    if (results.length > 0) {
      // Insert all matched classifications（一词多类）
      for (const result of results) {
        insert.bind([wordId, result.categoryId, result.confidence])
        insert.step()
        insert.reset()
        details.push(result)
      }

      classified++
    }
  }

  deleteAuto.free()
  insert.free()
  saveDatabase()

  return { classified, total: words.length, details }
}

/**
 * Get classification stats: how many words are classified vs unclassified.
 */
export function getClassificationStats(): {
  totalWords: number
  classified: number
  unclassified: number
  byCategory: { categoryId: number; nameCn: string; count: number }[]
} {
  const db = getDatabase()

  const totalRow = db.exec('SELECT COUNT(*) as c FROM words')
  const total = totalRow[0]?.values[0]?.[0] as number ?? 0

  const classifiedRow = db.exec(
    'SELECT COUNT(DISTINCT word_id) as c FROM word_categories'
  )
  const classified = classifiedRow[0]?.values[0]?.[0] as number ?? 0

  const byCat = db.exec(
    `SELECT c.id, c.name_cn, COUNT(wc.word_id) as count
     FROM categories c
     LEFT JOIN word_categories wc ON c.id = wc.category_id
     WHERE c.parent_id IS NULL
     GROUP BY c.id
     ORDER BY count DESC`
  )

  const byCategory = byCat[0]?.values.map(row => ({
    categoryId: row[0] as number,
    nameCn: row[1] as string,
    count: row[2] as number
  })) ?? []

  return {
    totalWords: total,
    classified,
    unclassified: total - classified,
    byCategory
  }
}
