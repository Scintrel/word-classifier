import { useState, useEffect } from 'react'
import {
  FolderTree, FolderOpen, Sparkles, Loader2, CheckCircle2,
  BarChart3, Download, ChevronRight, ChevronLeft, BookOpen
} from 'lucide-react'
import WordDetailPanel from '../components/WordDetailPanel'
import CategoryBadges from '../components/CategoryBadges'
import { LevelBadges } from '../components/WordLevelBadges'
import HelpTip from '../components/HelpTip'

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

export default function CategoryView() {
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

  useEffect(() => {
    loadCategories()
  }, [])

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

  async function loadCatWords(catId: number, page: number) {
    setWordsLoading(true)
    try {
      const result = await window.api.listWords({
        categoryId: catId,
        page,
        pageSize: WORD_PAGE_SIZE
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
  const selectedHasSubs = selectedCat !== null && selectedCat.parent_id === null && getSubCats(selectedCat.id).length > 0

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">分类浏览</h1>
            <HelpTip title="置信度">
              自动分类的置信度表示关键词匹配的强度（0.35~1.0），分数越高越可信。<br />
              点开一个单词可以查看它命中的关键词。
            </HelpTip>
            <HelpTip title="手动分类">
              你手动设置过的分类不会被覆盖——重新运行「自动分类」时，只处理没有手动分类的单词。
            </HelpTip>
          </div>
          <p className="text-muted-foreground">
            {totalWords > 0
              ? `共 ${totalWords} 个单词已分类到 ${rootCategories.length} 个主分类 · 点击任意分类查看单词`
              : '导入单词后，使用自动分类将单词分组'}
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Classification result banner */}
      {result && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-800">
              分类完成！成功将 {result.classified} 个单词分类
              {result.total > result.classified && `（共 ${result.total} 个待分类，${result.total - result.classified} 个无匹配）`}
            </span>
          </div>
          {result.details.length > 0 && (
            <div className="mt-2 max-h-24 overflow-y-auto text-xs text-green-700 space-y-0.5">
              {result.details.slice(0, 15).map((d, i) => (
                <span key={i} className="inline-block mr-3">
                  {d.word} <span className="text-green-500">({Math.round(d.confidence * 100)}%)</span>
                </span>
              ))}
              {result.details.length > 15 && (
                <span className="text-muted-foreground">...还有 {result.details.length - 15} 个</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <BarChart3 className="mx-auto mb-1 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold">{totalWords}</p>
          <p className="text-xs text-muted-foreground">已分类单词</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <FolderTree className="mx-auto mb-1 h-5 w-5 text-blue-500" />
          <p className="text-2xl font-bold">{rootCategories.length}</p>
          <p className="text-xs text-muted-foreground">主分类</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <FolderOpen className="mx-auto mb-1 h-5 w-5 text-green-500" />
          <p className="text-2xl font-bold">{categories.length - rootCategories.length}</p>
          <p className="text-xs text-muted-foreground">子分类</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Sparkles className="mx-auto mb-1 h-5 w-5 text-purple-500" />
          <p className="text-2xl font-bold">{categories.reduce((s, c) => s + (c.word_count ?? 0), 0)}</p>
          <p className="text-xs text-muted-foreground">总关联数</p>
        </div>
      </div>

      {/* Category tree */}
      <div className="space-y-3">
        {rootCategories.map((cat) => {
          const subCats = getSubCats(cat.id)
          const isExpanded = expandedCats.has(cat.id)
          const isSelected = selectedCat?.id === cat.id

          return (
            <div key={cat.id} className={`rounded-lg border overflow-hidden ${isSelected ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'}`}>
              {/* Root category header：点击 = 展开/收起 + 选中查看单词 */}
              <div
                className={`flex items-center justify-between p-4 hover:bg-accent/30 cursor-pointer transition-colors ${isSelected ? 'bg-accent/20' : ''}`}
                onClick={() => { toggleExpand(cat.id); selectCat(cat) }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    <FolderTree className="h-5 w-5" style={{ color: cat.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{cat.name_cn || cat.name}</h3>
                    <p className="text-xs text-muted-foreground">{cat.name}</p>
                  </div>
                  {subCats.length > 0 && (
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                    {cat.word_count ?? 0} 词
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleExport(cat.id)
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title="导出此分类"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sub-categories（点击子类直接查看它的单词） */}
              {isExpanded && subCats.length > 0 && (
                <div className="border-t border-border bg-muted/20 divide-y divide-border">
                  {subCats.map((sub) => {
                    const subSelected = selectedCat?.id === sub.id
                    return (
                      <div
                        key={sub.id}
                        onClick={() => selectCat(sub)}
                        className={`flex items-center justify-between px-4 py-2.5 pl-14 hover:bg-accent/30 transition-colors cursor-pointer ${subSelected ? 'bg-accent/30' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" style={{ color: sub.color }} />
                          <span className="text-sm">{sub.name_cn || sub.name}</span>
                          <span className="text-xs text-muted-foreground">({sub.name})</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {sub.word_count ?? 0} 词
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {rootCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16">
          <FolderTree className="mb-3 h-12 w-12 text-muted-foreground/20" />
          <p className="text-muted-foreground">还没有分类数据</p>
          <p className="text-sm text-muted-foreground/70">
            导入单词后，点击「自动分类」按钮即可
          </p>
        </div>
      )}

      {/* Selected category word list */}
      {selectedCat && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              「{selectedCat.name_cn || selectedCat.name}」的单词
              {selectedHasSubs && <span className="text-sm font-normal text-muted-foreground">（含子分类）</span>}
            </h2>
            <HelpTip title="分类的单词范围">
              选中主分类时，列表包含它所有子分类的单词；选中子分类时只显示该子分类的单词。<br />
              点击单词可以编辑。
            </HelpTip>
          </div>

          <div className="rounded-lg border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-sm font-medium text-muted-foreground">
                  <th className="px-4 py-3 w-32">单词</th>
                  <th className="px-4 py-3 w-28">音标</th>
                  <th className="px-4 py-3">释义</th>
                  <th className="px-4 py-3 w-36">分类</th>
                  <th className="px-4 py-3 w-52">等级</th>
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
                      <BookOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
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
                      <td className="px-4 py-3 font-semibold text-foreground">{word.word}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {word.phonetic_uk || word.phonetic_us || '-'}
                      </td>
                      <td className="px-4 py-3 max-w-[300px] truncate">
                        {word.definition_cn || word.definition_en || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadges raw={word.category_badges} />
                      </td>
                      <td className="px-4 py-3">
                        <LevelBadges difficulty={word.difficulty} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>第 {wordPage}/{totalPages} 页</span>
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
        </div>
      )}

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
