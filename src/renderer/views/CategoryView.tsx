import { useState, useEffect } from 'react'
import {
  FolderTree, FolderOpen, Sparkles, Loader2, CheckCircle2,
  BarChart3, Download, ChevronRight
} from 'lucide-react'

interface Category {
  id: number
  name: string
  name_cn: string
  parent_id: number | null
  color: string
  word_count: number
}

interface ClassifyResult {
  classified: number
  total: number
  details: { wordId: number; word: string; categoryId: number; confidence: number; matchedKeywords: string[] }[]
}

export default function CategoryView() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [classifying, setClassifying] = useState(false)
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set())

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

  const rootCategories = categories.filter(c => c.parent_id === null)
  const getSubCats = (parentId: number) => categories.filter(c => c.parent_id === parentId)
  const totalWords = rootCategories.reduce((sum, c) => sum + (c.word_count ?? 0), 0)

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
          <h1 className="text-2xl font-bold">分类浏览</h1>
          <p className="text-muted-foreground">
            {totalWords > 0
              ? `共 ${totalWords} 个单词已分类到 ${rootCategories.length} 个主分类`
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

          return (
            <div key={cat.id} className="rounded-lg border border-border overflow-hidden">
              {/* Root category header */}
              <div
                className="flex items-center justify-between p-4 hover:bg-accent/30 cursor-pointer transition-colors"
                onClick={() => toggleExpand(cat.id)}
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

              {/* Sub-categories */}
              {isExpanded && subCats.length > 0 && (
                <div className="border-t border-border bg-muted/20 divide-y divide-border">
                  {subCats.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between px-4 py-2.5 pl-14 hover:bg-accent/30 transition-colors"
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
                  ))}
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
    </div>
  )
}
