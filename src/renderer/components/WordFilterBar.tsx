import { Filter, X } from 'lucide-react'

interface Category {
  id: number
  name: string
  name_cn: string
  parent_id: number | null
  word_count?: number
}

interface WordFilterBarProps {
  categories: Category[]
  selectedCategory: number | null
  selectedDifficulty: string
  onCategoryChange: (categoryId: number | null) => void
  onDifficultyChange: (difficulty: string) => void
}

/**
 * Filter bar for the word list.
 * Filters by category and difficulty level.
 */
export default function WordFilterBar({
  categories,
  selectedCategory,
  selectedDifficulty,
  onCategoryChange,
  onDifficultyChange
}: WordFilterBarProps) {
  const rootCategories = categories.filter(c => c.parent_id === null)
  const hasActiveFilters = selectedCategory !== null || selectedDifficulty !== 'all'

  function clearAll() {
    onCategoryChange(null)
    onDifficultyChange('all')
  }

  return (
    <div className="flex items-center gap-4">
      <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Category filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">分类:</span>
        <select
          value={selectedCategory ?? ''}
          onChange={(e) => onCategoryChange(e.target.value ? Number(e.target.value) : null)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          <option value="">全部分类</option>
          {rootCategories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name_cn || cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Difficulty filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">难度:</span>
        <select
          value={selectedDifficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">全部难度</option>
          <option value="beginner">初级</option>
          <option value="intermediate">中级</option>
          <option value="advanced">高级</option>
          <option value="unknown">未知</option>
        </select>
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          清除筛选
        </button>
      )}
    </div>
  )
}
