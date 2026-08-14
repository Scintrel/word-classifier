import { Filter, X } from 'lucide-react'
import {
  LEVEL_DEFS, FREQ_BANDS, POS_OPTIONS, POS_LABELS
} from '../constants/wordMeta'

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
  selectedLevel: string
  selectedFrequency: string
  selectedPos: string
  selectedSort: string
  onCategoryChange: (categoryId: number | null) => void
  onLevelChange: (level: string) => void
  onFrequencyChange: (band: string) => void
  onPosChange: (pos: string) => void
  onSortChange: (sort: string) => void
}

/**
 * Filter bar for the word list.
 * Filters by category, exam level, frequency band and part of speech,
 * plus alphabetical sorting.
 */
export default function WordFilterBar({
  categories,
  selectedCategory,
  selectedLevel,
  selectedFrequency,
  selectedPos,
  selectedSort,
  onCategoryChange,
  onLevelChange,
  onFrequencyChange,
  onPosChange,
  onSortChange
}: WordFilterBarProps) {
  const rootCategories = categories.filter(c => c.parent_id === null)
  const hasActiveFilters =
    selectedCategory !== null ||
    selectedLevel !== 'all' ||
    selectedFrequency !== 'all' ||
    selectedPos !== 'all' ||
    selectedSort !== 'default'

  function clearAll() {
    onCategoryChange(null)
    onLevelChange('all')
    onFrequencyChange('all')
    onPosChange('all')
    onSortChange('default')
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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

      {/* Level filter（考试等级标签） */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">等级:</span>
        <select
          value={selectedLevel}
          onChange={(e) => onLevelChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">全部等级</option>
          {LEVEL_DEFS.map(d => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
          <option value="other">其他</option>
        </select>
      </div>

      {/* Frequency filter（词频档） */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">词频:</span>
        <select
          value={selectedFrequency}
          onChange={(e) => onFrequencyChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">全部词频</option>
          {FREQ_BANDS.map(b => (
            <option key={b.key} value={b.key}>{b.label}</option>
          ))}
          <option value="none">无数据</option>
        </select>
      </div>

      {/* Part of speech filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">词性:</span>
        <select
          value={selectedPos}
          onChange={(e) => onPosChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          <option value="all">全部词性</option>
          {POS_OPTIONS.map(p => (
            <option key={p} value={p}>{POS_LABELS[p] || p}</option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">排序:</span>
        <select
          value={selectedSort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        >
          <option value="default">默认（最近修改）</option>
          <option value="az">字母 A→Z</option>
          <option value="za">字母 Z→A</option>
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
