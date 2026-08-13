import { useState } from 'react'
import { Search, BookOpen } from 'lucide-react'

/**
 * SearchView - 搜索页面
 *
 * 搜索单词拼写和释义（中英文释义都搜）。
 * 结果以卡片列表展示。
 */
export default function SearchView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<unknown[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return

    try {
      const result = await window.api.listWords({
        search: query,
        pageSize: 100
      })
      setResults(result.words)
      setHasSearched(true)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">搜索</h1>
      <p className="mb-6 text-muted-foreground">
        搜索单词拼写或释义（中文、英文释义都可以搜）
      </p>

      {/* Search input area */}
      <div className="mb-6 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="输入单词或释义关键词..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full rounded-lg border border-input bg-background py-3 pl-12 pr-4 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
        >
          搜索
        </button>
      </div>

      {/* Results */}
      {hasSearched ? (
        results.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              找到 {results.length} 个结果
            </p>
            {(results as Array<Record<string, unknown>>).map((word) => (
              <div
                key={word.id as number}
                className="rounded-lg border border-border p-4 hover:border-primary/30 hover:bg-accent/30 transition-colors cursor-pointer"
              >
                <div className="mb-1 flex items-center gap-3">
                  <span className="text-lg font-semibold">{word.word as string}</span>
                  <span className="text-sm text-muted-foreground">
                    {word.phonetic_uk as string || word.phonetic_us as string || ''}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {word.part_of_speech as string || ''}
                  </span>
                </div>
                <p className="text-sm text-foreground/80">
                  {word.definition_cn as string || word.definition_en as string || '暂无释义'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {word.categories as string || '未分类'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16">
            <BookOpen className="mb-3 h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">没有找到匹配的单词</p>
            <p className="text-sm text-muted-foreground/70">试试其他关键词</p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16">
          <Search className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">输入关键词开始搜索</p>
          <p className="text-sm text-muted-foreground/70">
            支持中英文搜索单词、释义和例句
          </p>
        </div>
      )}
    </div>
  )
}
