import { useState, useEffect } from 'react'
import {
  FolderTree, FolderOpen, Sparkles, Loader2, CheckCircle2,
  Download, ChevronRight, ChevronLeft, MousePointerClick
} from 'lucide-react'
import WordDetailPanel from '../components/WordDetailPanel'
import CategoryBadges from '../components/CategoryBadges'
import { LevelBadges } from '../components/WordLevelBadges'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'

interface Category {
  id: number
  name: string
  name_cn: string
  parent_id: number | null
  color: string
  word_count: number
}

interface WordRow {
  id: number
  word: string
  phonetic_uk?: string
  phonetic_us?: string
  definition_cn?: string
  definition_en?: string
  difficulty?: string
  category_badges?: string
}

interface ClassifyResult {
  classified: number
  total: number
  details: { wordId: number; word: string; categoryId: number; confidence: number; matchedKeywords: string[] }[]
}

const WORD_PAGE_SIZE = 50

export default function CategoryView({ active = true }: { active?: boolean }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [classifying, setClassifying] = useState(false)
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set())

  // 选中的分类（根类或子类）+ 它的单词列表
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [words, setWords] = useState<WordRow[]>([])
  const [wordPage, setWordPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [wordsLoading, setWordsLoading] = useState(false)
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null)
  // 单词表排序
  const [wordSort, setWordSort] = useState('default')

  useEffect(() => {
    loadCategories()
  }, [])

  // 切回本页时刷新分类计数；若已选中分类，同时刷新其单词列表（选择与页码保持）
  useEffect(() => {
    if (!active) return
    loadCategories()
    if (selectedCat) loadCatWords(selectedCat.id, wordPage)
  }, [active])

  async function loadCategories() {
    setLoading(true)
    try {
      const cats = await window.api.getCategories()
      setCategories(cats as Category[])
    } catch (err) {
      console.error('Failed to load categories:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAutoClassify() {
    setClassifying(true)
    setResult(null)
    try {
      const res = await window.api.runClassification()
      setResult(res as ClassifyResult)
      // Reload categories to get updated word counts
      await loadCategories()
    } catch (err) {
      console.error('Classification failed:', err)
    } finally {
      setClassifying(false)
    }
  }

  async function handleExport(categoryId?: number) {
    try {
      const words = await window.api.exportWords({ categoryId })
      const json = JSON.stringify(words, null, 2)
      // Create a Blob and trigger download via anchor
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = categoryId
        ? `words-category-${categoryId}.json`
        : 'words-all.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  function toggleExpand(catId: number) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  /** 选中一个分类（根类或子类）并加载它的单词（根类自动包含子类，后端处理） */
  function selectCat(cat: Category) {
    setSelectedCat(cat)
    setWordPage(1)
    loadCatWords(cat.id, 1)
  }

  async function loadCatWords(catId: number, page: number, sort?: string) {
    setWordsLoading(true)
    try {
      const effectiveSort = sort ?? wordSort
      const result = await window.api.listWords({
        categoryId: catId,
        page,
        pageSize: WORD_PAGE_SIZE,
        sort: effectiveSort !== 'default' ? (effectiveSort as 'az' | 'za') : undefined
      })
      setWords(result.words as WordRow[])
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error('Failed to load category words:', err)
    } finally {
      setWordsLoading(false)
    }
  }

  function goWordPage(next: number) {
    const p = Math.max(1, Math.min(totalPages, next))
    setWordPage(p)
    if (selectedCat) loadCatWords(selectedCat.id, p)
  }

  const rootCategories = categories.filter(c => c.parent_id === null)
  const getSubCats = (parentId: number) => categories.filter(c => c.parent_id === parentId)
  const totalWords = rootCategories.reduce((sum, c) => sum + (c.word_count ?? 0), 0)
  const subCount = categories.length - rootCategories.length
  const selectedHasSubs = selectedCat !== null && selectedCat.parent_id === null && getSubCats(selectedCat.id).length > 0

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <PageHeader
        title="分类浏览"
        subtitle={`共 ${totalWords} 个单词已分类到 ${rootCategories.length} 个主分类 · 点左侧分类查看单词`}
        help={{
          title: '分类浏览说明',
          children: (
            <>
              点击左侧主分类可展开并查看它的单词（自动包含子分类）；点击子分类只看该子类的单词。<br />
              置信度表示自动分类的可信程度（0.35~1.0）。你手动设置过的分类不会被自动分类覆盖。
            </>
          )
        }}
        actions={
          <>
            <button
              onClick={() => handleExport()}
              className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              导出全部
            </button>
            <button
              onClick={handleAutoClassify}
              disabled={classifying}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {classifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {classifying ? '分类中...' : '自动分类所有单词'}
            </button>
          </>
        }
      />

      {/* Classification result banner */}
      {result && (
        <div className="mb-4 shrink-0 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-300">
              分类完成！成功将 {result.classified} 个单词分类
              {result.total > result.classified && `（${result.total - result.classified} 个无匹配）`}
            </span>
          </div>
        </div>
      )}

      {/* 左右分栏主体 */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* 左栏：统计 + 分类树（独立滚动） */}
        <div className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          {/* 紧凑统计条 */}
          <div className="flex shrink-0 divide-x divide-border border-b border-border">
            <div className="flex-1 px-3 py-2.5 text-center">
              <p className="text-lg font-bold leading-6">{totalWords}</p>
              <p className="text-[10px] text-muted-foreground">已分类</p>
            </div>
            <div className="flex-1 px-3 py-2.5 text-center">
              <p className="text-lg font-bold leading-6">{rootCategories.length}</p>
              <p className="text-[10px] text-muted-foreground">主分类</p>
            </div>
            <div className="flex-1 px-3 py-2.5 text-center">
              <p className="text-lg font-bold leading-6">{subCount}</p>
              <p className="text-[10px] text-muted-foreground">子分类</p>
            </div>
          </div>

          {/* 分类树 */}
          <div className="flex-1 overflow-y-auto p-2">
            {rootCategories.map((cat) => {
              const subCats = getSubCats(cat.id)
              const isExpanded = expandedCats.has(cat.id)
              const isSelected = selectedCat?.id === cat.id
              return (
                <div key={cat.id}>
                  {/* 根类行：点击 = 展开/收起 + 选中 */}
                  <div
                    onClick={() => { toggleExpand(cat.id); selectCat(cat) }}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isSelected ? 'bg-accent font-medium text-foreground' : 'hover:bg-accent/50 text-foreground/90'
                    }`}
                  >
                    {subCats.length > 0 ? (
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <FolderTree className="h-4 w-4 shrink-0" style={{ color: cat.color }} />
                    <span className="flex-1 truncate">{cat.name_cn || cat.name}</span>
                    <span className="text-xs text-muted-foreground">{cat.word_count ?? 0}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(cat.id) }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="导出此分类"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* 子类行 */}
                  {isExpanded && subCats.length > 0 && (
                    <div className="ml-4 border-l border-border/70 pl-2">
                      {subCats.map((sub) => {
                        const subSelected = selectedCat?.id === sub.id
                        return (
                          <div
                            key={sub.id}
                            onClick={() => selectCat(sub)}
                            className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${
                              subSelected ? 'bg-accent font-medium text-foreground' : 'hover:bg-accent/50 text-foreground/80'
                            }`}
                          >
                            <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: sub.color }} />
                            <span className="flex-1 truncate">{sub.name_cn || sub.name}</span>
                            <span className="text-xs text-muted-foreground">{sub.word_count ?? 0}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExport(sub.id) }}
                              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                              title="导出此分类"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {rootCategories.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                还没有分类数据，导入单词后点击「自动分类」即可
              </div>
            )}
          </div>
        </div>

        {/* 右栏：选中分类的单词表 */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
          {selectedCat ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 className="font-semibold">
                  「{selectedCat.name_cn || selectedCat.name}」的单词
                  {selectedHasSubs && <span className="text-sm font-normal text-muted-foreground">（含子分类）</span>}
                </h2>
                <div className="flex items-center gap-2">
                  <select
                    value={wordSort}
                    onChange={(e) => {
                      const v = e.target.value
                      setWordSort(v)
                      setWordPage(1)
                      if (selectedCat) loadCatWords(selectedCat.id, 1, v)
                    }}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  >
                    <option value="default">默认排序</option>
                    <option value="az">字母 A→Z</option>
                    <option value="za">字母 Z→A</option>
                  </select>
                  <span className="text-xs text-muted-foreground">第 {wordPage}/{Math.max(totalPages, 1)} 页</span>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <table className="w-full table-fixed">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border bg-muted/50 text-left text-sm font-medium text-muted-foreground">
                      <th className="px-4 py-3 w-32">单词</th>
                      <th className="px-4 py-3 w-32">音标</th>
                      <th className="px-4 py-3">释义</th>
                      <th className="px-4 py-3 w-36">分类</th>
                      <th className="px-4 py-3 w-28">等级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wordsLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">加载中...</span>
                        </td>
                      </tr>
                    ) : words.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <p className="text-sm text-muted-foreground">这个分类下还没有单词</p>
                        </td>
                      </tr>
                    ) : (
                      words.map((word) => (
                        <tr
                          key={word.id}
                          onClick={() => setSelectedWordId(word.id)}
                          className="border-b border-border text-sm hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-foreground truncate" title={word.word}>{word.word}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono truncate"
                            title={word.phonetic_uk || word.phonetic_us || ''}>
                            {word.phonetic_uk || word.phonetic_us || '-'}
                          </td>
                          <td className="px-4 py-3 truncate" title={word.definition_cn || word.definition_en || ''}>
                            {word.definition_cn || word.definition_en || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <CategoryBadges raw={word.category_badges} />
                          </td>
                          <td className="px-4 py-3">
                            <LevelBadges difficulty={word.difficulty} maxLevels={1} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 分页（固定在右栏底部） */}
              {totalPages > 1 && (
                <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 text-sm text-muted-foreground">
                  <span>共 {words.length} 条本页</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => goWordPage(wordPage - 1)} disabled={wordPage === 1}
                      className="flex items-center gap-0.5 rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
                      <ChevronLeft className="h-3.5 w-3.5" />上一页
                    </button>
                    <button onClick={() => goWordPage(wordPage + 1)} disabled={wordPage === totalPages}
                      className="flex items-center gap-0.5 rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
                      下一页<ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<MousePointerClick className="h-12 w-12" />}
              title="点左侧分类查看单词"
              description="选中主分类会显示它所有子分类的单词；选中子分类只看该子类的单词。"
            />
          )}
        </div>
      </div>

      {/* Word detail panel (slide-out) */}
      {selectedWordId !== null && (
        <WordDetailPanel
          wordId={selectedWordId}
          onClose={() => setSelectedWordId(null)}
          onSaved={async () => {
            if (selectedCat) await loadCatWords(selectedCat.id, wordPage)
            await loadCategories()
          }}
        />
      )}
    </div>
  )
}
