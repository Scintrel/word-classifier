import { useState, useEffect } from 'react'
import {
  Terminal, Database, FlaskConical, BookMarked, History, Activity,
  Search, Plus, Save, Trash2, RotateCcw, AlertTriangle, Loader2
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import HelpTip from '../components/HelpTip'

interface Overview {
  version: string
  platform: string
  dbPath: string
  dbSize: number
  words: number
  categories: number
  examples: number
  imports: number
  dictEntries: number
  logEntries: number
  ecdictEntries: number
}

interface DictEntry {
  word: string
  phonetic?: string | null
  definition?: string | null
  pos?: string | null
  created_at?: string
  updated_at?: string
}

interface LookupResult {
  word: string
  userEntry: DictEntry | null
  dictEntry: DictEntry | null
  classification: { categoryId: number; categoryName: string; confidence: number; matchedKeywords: string[] }[]
  found: boolean
}

interface LogRow {
  id: number
  entity_type: string
  entity_key: string
  action: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

type TabKey = 'overview' | 'sandbox' | 'dict' | 'log' | 'actions'

const ACTION_LABELS: Record<string, string> = {
  create: '新增', update: '修改', delete: '删除', undo: '撤销'
}
const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  undo: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
}

/** 把日志里的 JSON 词条压缩成一行可读文本 */
function entrySummary(v: string | null): string {
  if (!v) return '（无）'
  try {
    const e = JSON.parse(v) as DictEntry
    return [e.word, e.phonetic, e.definition, e.pos].filter(Boolean).join(' | ') || '（空）'
  } catch { return v }
}

export default function DevModeView() {
  const [tab, setTab] = useState<TabKey>('overview')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [warned, setWarned] = useState(localStorage.getItem('dev-warned') === '1')

  // 查词试验场
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const [looking, setLooking] = useState(false)

  // 小词典
  const [entries, setEntries] = useState<DictEntry[]>([])
  const [unfixable, setUnfixable] = useState<string[]>([])
  const [draft, setDraft] = useState<DictEntry | null>(null)  // null=未编辑
  const [dictBusy, setDictBusy] = useState(false)

  // 修改日志
  const [logRows, setLogRows] = useState<LogRow[]>([])
  const [logPage, setLogPage] = useState(1)
  const [logTotalPages, setLogTotalPages] = useState(1)

  // 操作记录
  const [actionRows, setActionRows] = useState<Record<string, unknown>[]>([])
  const [actionPage, setActionPage] = useState(1)
  const [actionTotalPages, setActionTotalPages] = useState(1)

  useEffect(() => {
    loadOverview()
  }, [])

  useEffect(() => {
    if (tab === 'dict') loadDict()
    if (tab === 'log') loadLog(1)
    if (tab === 'actions') loadActions(1)
  }, [tab])

  async function loadOverview() {
    try {
      const data = await window.api.devGetOverview()
      setOverview(data as Overview)
    } catch (err) { console.error('Overview failed:', err) }
  }

  async function handleLookup() {
    const w = query.trim()
    if (!w) return
    setLooking(true)
    try {
      const res = await window.api.devLookupWord(w)
      setLookup(res as LookupResult)
    } catch (err) { console.error('Lookup failed:', err) }
    finally { setLooking(false) }
  }

  async function loadDict() {
    try {
      const [es, uf] = await Promise.all([window.api.devListDictEntries(), window.api.devGetUnfixableWords()])
      setEntries(es as DictEntry[])
      setUnfixable(uf as string[])
    } catch (err) { console.error('Load dict failed:', err) }
  }

  async function saveDraft() {
    if (!draft || !draft.word.trim()) return
    setDictBusy(true)
    try {
      const res = await window.api.devSaveDictEntry({
        word: draft.word.trim(),
        phonetic: draft.phonetic ?? '',
        definition: draft.definition ?? '',
        pos: draft.pos ?? ''
      })
      if (!res.ok) { alert(res.message || '保存失败'); return }
      setDraft(null)
      await loadDict()
      await loadOverview()
    } catch (err) { console.error('Save entry failed:', err) }
    finally { setDictBusy(false) }
  }

  async function deleteEntry(word: string) {
    if (!confirm(`确定要从小词典删除「${word}」吗？可在修改日志中撤销。`)) return
    setDictBusy(true)
    try {
      await window.api.devDeleteDictEntry(word)
      await loadDict()
      await loadOverview()
    } catch (err) { console.error('Delete entry failed:', err) }
    finally { setDictBusy(false) }
  }

  async function loadLog(page: number) {
    try {
      const res = await window.api.devListChangeLog(page, 50)
      setLogRows(res.rows as LogRow[])
      setLogPage(res.page)
      setLogTotalPages(res.totalPages)
    } catch (err) { console.error('Load log failed:', err) }
  }

  async function loadActions(page: number) {
    try {
      const res = await window.api.devListUserActions(page, 50)
      setActionRows(res.rows as Record<string, unknown>[])
      setActionPage(res.page)
      setActionTotalPages(res.totalPages)
    } catch (err) { console.error('Load actions failed:', err) }
  }

  async function undoChange(logId: number) {
    setDictBusy(true)
    try {
      const res = await window.api.devUndoChange(logId)
      if (!res.ok) { alert(res.message || '撤销失败'); return }
      await loadLog(logPage)
      await loadDict()
      await loadOverview()
    } catch (err) { console.error('Undo failed:', err) }
    finally { setDictBusy(false) }
  }

  /** 从查词结果/待补建议跳去小词典并预填表单 */
  function prefillEntry(word: string) {
    setDraft({ word, phonetic: '', definition: '', pos: '' })
    setTab('dict')
  }

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'overview', label: '数据总览', icon: Database },
    { key: 'sandbox', label: '查词试验场', icon: FlaskConical },
    { key: 'dict', label: '小词典', icon: BookMarked },
    { key: 'log', label: '修改日志', icon: History },
    { key: 'actions', label: '操作记录', icon: Activity },
  ]

  return (
    <div>
      <PageHeader
        title="开发者模式"
        subtitle="看看应用内部是怎么工作的，维护属于你自己的小词典"
        help={{
          title: '开发者模式是什么',
          children: (
            <>
              这里可以看到应用的"内部信息"：数据库位置、词典与分类引擎对单词的判断。<br />
              你可以在「小词典」里给大词典查不到的词手动补词条，之后「单词检修」的词典补全就会用上它。<br />
              所有修改都会自动记录在「修改日志」里，可一键撤销；Claude 也能直接读取这些日志帮你分析。
            </>
          )
        }}
      />

      {/* 首次进入提醒（点「知道了」不再出现） */}
      {!warned && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/40">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">这是开发者模式</p>
            <p className="mt-0.5">
              这里的操作可能看不太懂——没关系，看不懂的不碰就行。任何修改数据的操作都会记入「修改日志」，可以一键撤销。
            </p>
          </div>
          <button
            onClick={() => { localStorage.setItem('dev-warned', '1'); setWarned(true) }}
            className="shrink-0 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/60"
          >
            知道了
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ============ 数据总览 ============ */}
      {tab === 'overview' && (
        overview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-2xl font-bold">{overview.words}</p>
                <p className="text-xs text-muted-foreground">单词</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-2xl font-bold">{overview.categories}</p>
                <p className="text-xs text-muted-foreground">分类</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-2xl font-bold">{overview.examples}</p>
                <p className="text-xs text-muted-foreground">例句</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-2xl font-bold">{overview.imports}</p>
                <p className="text-xs text-muted-foreground">导入次数</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-2xl font-bold">{overview.dictEntries}</p>
                <p className="text-xs text-muted-foreground">小词典词条</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-2xl font-bold">{overview.logEntries}</p>
                <p className="text-xs text-muted-foreground">修改日志条数</p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">应用版本:</span>
                <span className="font-mono">{overview.version}</span>
                <span className="text-muted-foreground ml-2">系统:</span>
                <span className="font-mono">{overview.platform}</span>
              </p>
              <p className="flex items-center gap-2 break-all">
                <span className="text-muted-foreground shrink-0">数据库文件:</span>
                <span className="font-mono text-xs">{overview.dbPath}</span>
                <span className="text-muted-foreground shrink-0">({(overview.dbSize / 1024 / 1024).toFixed(1)} MB)</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-muted-foreground">内置大词典词条:</span>
                <span className="font-mono">{overview.ecdictEntries.toLocaleString()}</span>
              </p>
              <p className="text-xs text-muted-foreground/70">
                数据库文件包含你的全部数据，出问题时把这个文件路径告诉 Claude 即可分析。
              </p>
            </div>
          </div>
        ) : (
          <EmptyState icon={<Loader2 className="h-12 w-12 animate-spin" />} title="加载中..." />
        )
      )}

      {/* ============ 查词试验场 ============ */}
      {tab === 'sandbox' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="输入任意单词，例如 apple 或 esp."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleLookup}
              disabled={looking || !query.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              试一试
            </button>
            <HelpTip title="查词试验场">
              输入单词，看看：<br />
              ① 你的小词典和内置大词典里有没有它、原始数据是什么<br />
              ② 自动分类引擎会把它分到哪几个类、命中了哪些关键词、置信度多少。<br />
              纯只读，不会改动任何数据。
            </HelpTip>
          </div>

          {lookup ? (
            lookup.word ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  「{lookup.word}」的查询结果：
                </p>

                {/* 词典命中 */}
                {lookup.found ? (
                  <div className="space-y-2">
                    {lookup.userEntry && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/40">
                        <p className="text-xs font-medium text-green-700 dark:text-green-300">
                          小词典命中（你的词条，优先于大词典）
                        </p>
                        <p className="mt-1 text-sm">
                          <span className="font-semibold">{lookup.userEntry.word}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{lookup.userEntry.phonetic}</span>
                        </p>
                        <p className="mt-0.5 text-sm">{lookup.userEntry.definition}</p>
                        {lookup.userEntry.pos && <p className="text-xs text-muted-foreground">词性: {lookup.userEntry.pos}</p>}
                      </div>
                    )}
                    {lookup.dictEntry && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/40">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          大词典命中（内置 ECDICT）
                        </p>
                        <p className="mt-1 text-sm">
                          <span className="font-semibold">{lookup.dictEntry.word}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{lookup.dictEntry.phonetic}</span>
                        </p>
                        <p className="mt-0.5 text-sm">{lookup.dictEntry.definition}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/40">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        两个词典都查不到「{lookup.word}」
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      如果这是一个真实存在的词，你可以在小词典里为它补上音标和释义，之后词典补全就能用了。
                    </p>
                    <button
                      onClick={() => prefillEntry(lookup.word)}
                      className="mt-2 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/60"
                    >
                      <Plus className="mr-1 inline h-3 w-3" />
                      加入小词典
                    </button>
                  </div>
                )}

                {/* 分类预览 */}
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs font-medium text-muted-foreground">自动分类预览（只读，不影响实际数据）</p>
                  {lookup.classification.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {lookup.classification.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                            {c.categoryName || `分类 ${c.categoryId}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            置信度 {Math.round(c.confidence * 100)}%
                            {c.matchedKeywords.length > 0 && (
                              <span> · 命中: {c.matchedKeywords.join('、')}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      没有匹配任何分类（没有释义或词性信息时无法分类）
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">输入单词后点「试一试」</p>
            )
          ) : (
            <EmptyState
              icon={<FlaskConical className="h-12 w-12" />}
              title="输入单词，看看应用怎么理解它"
              description="例如输入 apple，可以看到词典数据（音标/释义/词性/等级/词频）和自动分类的判断依据"
            />
          )}
        </div>
      )}

      {/* ============ 小词典 ============ */}
      {tab === 'dict' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">我的词条（{entries.length}）</h2>
            <HelpTip title="小词典">
              大词典查不到的词（比如缩写、专有名词、或你词表里的特殊拼写），在这里手动补上音标和释义。<br />
              小词典优先级最高：查词、词典补全、等级回填都会优先用它。<br />
              每次新增/修改/删除都会自动写入「修改日志」，可撤销。
            </HelpTip>
            <div className="flex-1" />
            {!draft && (
              <button
                onClick={() => setDraft({ word: '', phonetic: '', definition: '', pos: '' })}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                新增词条
              </button>
            )}
          </div>

          {/* 待补建议 */}
          {unfixable.length > 0 && !draft && (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                你的词库里有 {unfixable.length} 个词两个词典都查不到，点击即可补词条：
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unfixable.map(w => (
                  <button
                    key={w}
                    onClick={() => prefillEntry(w)}
                    className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Plus className="mr-0.5 inline h-3 w-3" />
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 编辑表单 */}
          {draft && (
            <div className="rounded-lg border border-primary/30 bg-card p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">单词 *</label>
                  <input
                    type="text"
                    value={draft.word}
                    disabled={!!draft.word && entries.some(e => e.word === draft.word)}
                    onChange={e => setDraft({ ...draft, word: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">音标</label>
                  <input
                    type="text"
                    value={draft.phonetic ?? ''}
                    onChange={e => setDraft({ ...draft, phonetic: e.target.value })}
                    placeholder="/ˈwɜːd/"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium">中文释义</label>
                  <input
                    type="text"
                    value={draft.definition ?? ''}
                    onChange={e => setDraft({ ...draft, definition: e.target.value })}
                    placeholder="例如：n. 缩写；等等（etc. 的常见缩写）"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">词性</label>
                  <input
                    type="text"
                    value={draft.pos ?? ''}
                    onChange={e => setDraft({ ...draft, pos: e.target.value })}
                    placeholder="例如：abbreviation 或 noun,verb"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={saveDraft}
                  disabled={dictBusy || !draft.word.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  保存（自动记日志）
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 词条表 */}
          <div className="rounded-lg border border-border">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-sm font-medium text-muted-foreground">
                  <th className="px-4 py-3 w-40">单词</th>
                  <th className="px-4 py-3 w-44">音标</th>
                  <th className="px-4 py-3">释义</th>
                  <th className="px-4 py-3 w-36">词性</th>
                  <th className="px-4 py-3 w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      小词典还是空的。大词典查不到的词可以在这里补词条。
                    </td>
                  </tr>
                ) : (
                  entries.map(e => (
                    <tr key={e.word} className="border-b border-border text-sm hover:bg-accent/30">
                      <td className="px-4 py-3 font-semibold truncate" title={e.word}>{e.word}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate" title={e.phonetic ?? ''}>{e.phonetic || '-'}</td>
                      <td className="px-4 py-3 truncate" title={e.definition ?? ''}>{e.definition || '-'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.pos || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setDraft({ ...e })}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="编辑"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteEntry(e.word)}
                            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ 修改日志 ============ */}
      {tab === 'log' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">修改日志</h2>
            <HelpTip title="修改日志">
              小词典的每次新增/修改/删除都会自动记录在这里：改了什么、旧值新值、时间。<br />
              每条日志都可以「撤销」恢复原状；撤销动作本身也会记一条日志。<br />
              这些日志存在数据库里，Claude 可以直接读取帮你分析，不需要导出文件。
            </HelpTip>
          </div>

          {logRows.length === 0 ? (
            <EmptyState
              icon={<History className="h-12 w-12" />}
              title="还没有修改记录"
              description="去「小词典」里新增或修改词条后，记录会自动出现在这里"
            />
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {logRows.map(row => (
                <div key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-accent/20">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ACTION_COLORS[row.action] ?? 'bg-muted'}`}>
                        {ACTION_LABELS[row.action] ?? row.action}
                      </span>
                      <span className="font-mono text-sm font-semibold">{row.entity_key}</span>
                      <span className="text-xs text-muted-foreground">{row.created_at}</span>
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <p>改动前: {entrySummary(row.old_value)}</p>
                      <p>改动后: {entrySummary(row.new_value)}</p>
                    </div>
                  </div>
                  {row.action !== 'undo' && (
                    <button
                      onClick={() => undoChange(row.id)}
                      disabled={dictBusy}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      撤销
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {logTotalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>第 {logPage}/{logTotalPages} 页</span>
              <div className="flex gap-1">
                <button onClick={() => loadLog(Math.max(1, logPage - 1))} disabled={logPage === 1}
                  className="rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
                  上一页
                </button>
                <button onClick={() => loadLog(Math.min(logTotalPages, logPage + 1))} disabled={logPage === logTotalPages}
                  className="rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ 操作记录 ============ */}
      {tab === 'actions' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">操作记录</h2>
            <HelpTip title="操作记录">
              应用会自动记录你的每一步关键操作：切换页面、运行检查、批量任务、导入、分类、编辑单词、小词典修改等。<br />
              出问题时，Claude 直接读这张表就能完整还原你的操作过程，不需要你回忆。<br />
              记录只存在你电脑的数据库里，不会上传。
            </HelpTip>
          </div>

          {actionRows.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-12 w-12" />}
              title="还没有操作记录"
              description="切换页面或使用功能后，记录会自动出现在这里"
            />
          ) : (
            <div className="rounded-lg border border-border divide-y divide-border">
              {actionRows.map(row => (
                <div key={row.id as number} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/20">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">#{row.id}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{row.action as string}</span>
                      {row.page && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{row.page as string}</span>
                      )}
                    </div>
                    {row.detail && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={row.detail as string}>
                        {row.detail as string}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{row.created_at as string}</span>
                </div>
              ))}
            </div>
          )}

          {actionTotalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>第 {actionPage}/{actionTotalPages} 页</span>
              <div className="flex gap-1">
                <button onClick={() => loadActions(Math.max(1, actionPage - 1))} disabled={actionPage === 1}
                  className="rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
                  上一页
                </button>
                <button onClick={() => loadActions(Math.min(actionTotalPages, actionPage + 1))} disabled={actionPage === actionTotalPages}
                  className="rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
