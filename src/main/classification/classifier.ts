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
 * Classify a single word by matching against category keywords.
 *
 * Strategy:
 * 1. Check the word itself against all category keyword lists
 * 2. Check the word's definitions (CN + EN) for keyword matches
 * 3. Score each category by number of keyword matches
 * 4. Assign to the best-matching category (and sub-category)
 * 5. Confidence is based on match count vs total keywords checked
 */
function classifyWord(
  wordId: number,
  word: string,
  definitionCn: string | null,
  definitionEn: string | null
): ClassificationResult | null {
  const wordLower = word.toLowerCase().trim()
  const defCnLower = (definitionCn ?? '').toLowerCase()
  const defEnLower = (definitionEn ?? '').toLowerCase()

  // Combine all text to search in
  const searchText = `${wordLower} ${defCnLower} ${defEnLower}`

  let bestCategory: CategoryKeywords | null = null
  let bestScore = 0
  let bestSubId: number | null = null
  let bestMatched: string[] = []

  for (const cat of CATEGORY_KEYWORDS) {
    // Reset per-category state to prevent leaking between categories
    let catSubId: number | null = null
    let catSubMatched: string[] = []

    // Check root category keywords
    const rootMatches = cat.keywords.filter(kw =>
      searchText.includes(kw.toLowerCase())
    )
    let score = rootMatches.length

    // Check sub-categories
    let subScore = 0
    if (cat.subCategories) {
      for (const sub of cat.subCategories) {
        const subMatches = sub.keywords.filter(kw =>
          searchText.includes(kw.toLowerCase())
        )
        if (subMatches.length > subScore) {
          subScore = subMatches.length
          catSubId = sub.id
          catSubMatched = subMatches
        }
      }
    }

    score += subScore

    // Bonus: check CN definition against category name_cn keywords
    const catNameCn = cat.keywords.filter(kw =>
      defCnLower.includes(kw.toLowerCase()) || searchText.includes(kw.toLowerCase())
    ).length
    if (catNameCn > 0) {
      score += Math.min(catNameCn, 3) // Cap bonus at 3 to prevent over-weighting
    }

    if (score > bestScore) {
      bestScore = score
      bestCategory = cat
      bestSubId = subScore > 0 ? catSubId : null
      bestMatched = [...rootMatches, ...catSubMatched]
    }
  }

  // Require at least 1 keyword match to classify
  if (bestScore === 0 || !bestCategory) return null

  // Determine which category ID to assign
  const assignedCategoryId = bestSubId ?? bestCategory.categoryId

  // Calculate confidence (0.3–1.0 range)
  const confidence = Math.min(1.0, 0.3 + bestScore * 0.15)

  return {
    wordId,
    word,
    categoryId: assignedCategoryId,
    categoryName: '',
    confidence: Math.round(confidence * 100) / 100,
    matchedKeywords: bestMatched.slice(0, 5)
  }
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

    const result = classifyWord(wordId, word, defCn, defEn)

    if (result) {
      // Remove old auto-classifications
      deleteAuto.bind([wordId])
      deleteAuto.step()
      deleteAuto.reset()

      // Insert new classification
      insert.bind([wordId, result.categoryId, result.confidence])
      insert.step()
      insert.reset()

      classified++
      details.push(result)
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
