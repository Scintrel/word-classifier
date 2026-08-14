import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import WordFilterBar from '../components/WordFilterBar'
import WordDetailPanel from '../components/WordDetailPanel'
import CategoryBadges from '../components/CategoryBadges'
import { LevelBadges, FreqBadge } from '../components/WordLevelBadges'
import PageHeader from '../components/PageHeader'
import HelpTip from '../components/HelpTip'

interface WordRow {
  id: number
  word: string
  phonetic_uk?: string
  phonetic_us?: string
  definition_cn?: string
  definition_en?: string
  part_of_speech?: string
  difficulty?: string
  frequency?: number | null
  category_badges?: string
}

interface Category {
  id: number
  name: string
  name_cn: string
  parent_id: number | null
  word_count?: number
}

/**
 * WordListView - 单词列表页面
 *
 * Shows all imported words in a sortable, filterable table.
 * Click a row to open the detail/edit panel.
 * 词性不单独占列（释义里已含词性），但仍可用筛选栏按词性过滤。
 * 页面常驻：切走只是隐藏，筛选/翻页保持；切回来自动拉取最新数据。
 */
export default function WordListView({ active = true }: { active?: boolean }) {
  const [words, setWords] = useState<WordRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Filters
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [selectedFrequency, setSelectedFrequency] = useState('all')
  const [selectedPos, setSelectedPos] = useState('all')
  const [selectedSort, setSelectedSort] = useState('default')

  // Detail panel
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null)

  const pageSize = 50

  // Load categories for filter
  useEffect(() => {
    loadCategories()
  }, [])

  // Load words when page or filters change
  useEffect(() => {
    loadWords()
  }, [page, selectedCategory, selectedLevel, selectedFrequency, selectedPos, selectedSort])

  // 切回本页时刷新数据（保持筛选/页码不变）
  useEffect(() => {
    if (active) loadWords()
  }, [active])

  async function loadCategories() {
    try {
      const result = await window.api.getCategories()
      setCategories(result as Category[])
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  async function loadWords() {
    setLoading(true)
    try {
      const result = await window.api.listWords({
        page,
        pageSize,
        search: search || undefined,
        categoryId: selectedCategory ?? undefined,
        difficulty: selectedLevel !== 'all' ? selectedLevel : undefined,
        frequency: selectedFrequency !== 'all' ? selectedFrequency : undefined,
        partOfSpeech: selectedPos !== 'all' ? selectedPos : undefined,
        sort: selectedSort !== 'default' ? (selectedSort as 'az' | 'za') : undefined
      })
      setWords(result.words as WordRow[])
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error('Failed to load words:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    setPage(1)
    loadWords()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  const handleCategoryChange = useCallback((catId: number | null) => {
    setSelectedCategory(catId)
    setPage(1)
  }, [])

  const handleLevelChange = useCallback((level: string) => {
    setSelectedLevel(level)
    setPage(1)
  }, [])

  const handleFrequencyChange = useCallback((band: string) => {
    setSelectedFrequency(band)
    setPage(1)
  }, [])

  const handlePosChange = useCallback((pos: string) => {
    setSelectedPos(pos)
    setPage(1)
  }, [])

  const handleSortChange = useCallback((sort: string) => {
    setSelectedSort(sort)
    setPage(1)
  }, [])

  function handleSaved() {
    loadWords()
  }

  const hasFilter = selectedCategory !== null ||
    selectedLevel !== 'all' || selectedFrequency !== 'all' || selectedPos !== 'all'

  return (
    <div>
      <PageHeader
        title="单词列表"
        subtitle={`共 ${total} 个单词${hasFilter ? ' · 已筛选' : ''}`}
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索单词或释义..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-64 rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSearch}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              搜索
            </button>
          </>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-2">
        <WordFilterBar
          categories={categories}
          selectedCategory={selectedCategory}
          selectedLevel={selectedLevel}
          selectedFrequency={selectedFrequency}
          selectedPos={selectedPos}
          selectedSort={selectedSort}
          onCategoryChange={handleCategoryChange}
          onLevelChange={handleLevelChange}
          onFrequencyChange={handleFrequencyChange}
          onPosChange={handlePosChange}
          onSortChange={handleSortChange}
        />
        <HelpTip title="筛选说明">
          分类：按主分类筛选（自动包含其子分类里的单词）。<br />
          等级：按考试等级标签筛选（初中/高中/CET4/CET6/考研/托福/雅思/GRE），选「其他」= 没有等级标签的词。<br />
          词频：按 COCA 语料库词频排名区间筛选（数字越小越常用）。<br />
          词性：按词性筛选（一词多词性时命中任意一个即匹配）。<br />
          表格里只显示第一个等级徽章，点开单词可看全部等级。
        </HelpTip>
      </div>

      {/* Word table */}
      <div className="rounded-lg border border-border">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3 w-32">单词</th>
              <th className="px-4 py-3 w-32">音标</th>
              <th className="px-4 py-3">释义</th>
              <th className="px-4 py-3 w-36">分类</th>
              <th className="px-4 py-3 w-28">等级</th>
              <th className="px-4 py-3 w-20">词频</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">加载中...</span>
                </td>
              </tr>
            ) : words.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-muted-foreground">
                    {search || hasFilter
                      ? '没有找到匹配的单词，试试调整筛选条件'
                      : '还没有单词。去「导入单词」页面导入你的第一个单词表吧！'
                    }
                  </p>
                </td>
              </tr>
            ) : (
              words.map((word) => (
                <tr
                  key={word.id}
                  onClick={() => setSelectedWordId(word.id)}
                  className="border-b border-border text-sm hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-foreground truncate" title={word.word}>
                    {word.word}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono truncate"
                    title={word.phonetic_uk || word.phonetic_us || ''}>
                    {word.phonetic_uk || word.phonetic_us || '-'}
                  </td>
                  <td className="px-4 py-3 max-w-[300px] truncate"
                    title={word.definition_cn || word.definition_en || ''}>
                    {word.definition_cn || word.definition_en || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadges raw={word.category_badges} />
                  </td>
                  <td className="px-4 py-3">
                    <LevelBadges difficulty={word.difficulty} maxLevels={1} />
                  </td>
                  <td className="px-4 py-3">
                    <FreqBadge frequency={word.frequency} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 个单词 · 第 {page}/{totalPages} 页</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors"
              title="首页">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-0.5 rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />上一页
            </button>
            <span className="mx-1 text-xs">第</span>
            <input
              type="number" min={1} max={totalPages}
              value={page}
              onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v) }}
              className="w-14 rounded-md border border-border bg-background px-2 py-1.5 text-center text-xs focus:border-primary focus:outline-none"
            />
            <span className="text-xs">页</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-0.5 rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
              下一页<ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors"
              title="末页">»</button>
          </div>
        </div>
      )}

      {/* Word detail panel (slide-out) */}
      {selectedWordId !== null && (
        <WordDetailPanel
          wordId={selectedWordId}
          onClose={() => setSelectedWordId(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
