import { useState } from 'react'
import { Search, BookOpen } from 'lucide-react'
import WordDetailPanel from '../components/WordDetailPanel'
import CategoryBadges from '../components/CategoryBadges'
import { LevelBadges, FreqBadge } from '../components/WordLevelBadges'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { POS_LABELS } from '../constants/wordMeta'

/** 词性显示为中文标签（noun,verb → 名词、动词） */
function posLabels(pos?: string): string {
  if (!pos) return ''
  return pos.split(',').map(s => s.trim()).filter(Boolean)
    .map(s => POS_LABELS[s] || s).join('、')
}

/**
 * SearchView - 搜索页面
 *
 * 搜索单词拼写和释义（中英文释义都搜）。
 * 结果以卡片列表展示，点击卡片打开编辑面板。
 */
export default function SearchView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<unknown[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null)

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
      <PageHeader
        title="搜索"
        subtitle="搜索单词拼写或释义（中文、英文释义都可以搜）"
        help={{
          title: '搜索范围',
          children: (
            <>
              搜索范围：单词拼写、中文释义、英文释义。<br />
              排序规则：拼写完全一致的最靠前（搜 art 第一个就是 art），前缀匹配其次（art → artist），其余按词频从高到低。<br />
              点击任意结果卡片即可编辑该单词。
            </>
          )
        }}
      />

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
                onClick={() => setSelectedWordId(word.id as number)}
                className="rounded-lg border border-border p-4 hover:border-primary/30 hover:bg-accent/30 transition-colors cursor-pointer"
              >
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  <span className="text-lg font-semibold">{word.word as string}</span>
                  <span className="text-sm text-muted-foreground">
                    {word.phonetic_uk as string || word.phonetic_us as string || ''}
                  </span>
                  {word.part_of_speech ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {posLabels(word.part_of_speech as string)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-foreground/80">
                  {word.definition_cn as string || word.definition_en as string || '暂无释义'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CategoryBadges raw={word.category_badges as string | null} />
                  <LevelBadges difficulty={word.difficulty as string | null} maxLevels={1} />
                  <FreqBadge frequency={word.frequency as number | null} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen className="h-12 w-12" />}
            title="没有找到匹配的单词"
            description="试试其他关键词"
          />
        )
      ) : (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title="输入关键词开始搜索"
          description="支持中英文搜索单词和释义"
        />
      )}

      {/* Word detail panel (slide-out) */}
      {selectedWordId !== null && (
        <WordDetailPanel
          wordId={selectedWordId}
          onClose={() => setSelectedWordId(null)}
          onSaved={() => handleSearch()}
        />
      )}
    </div>
  )
}
