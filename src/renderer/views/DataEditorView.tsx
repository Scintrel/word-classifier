import { useState, useEffect } from 'react'
import {
  Edit3, AlertTriangle, AlertCircle, CheckCircle2,
  Search, XCircle, Zap, ChevronDown, ChevronRight, Award, Slash,
  ChevronLeft, X
} from 'lucide-react'
import WordDetailPanel from '../components/WordDetailPanel'
import PageHeader from '../components/PageHeader'
import SectionCard from '../components/SectionCard'
import EmptyState from '../components/EmptyState'
import { useTaskStore, TASK_LABELS, type TaskType } from '../stores/taskStore'
import { startDictFix, startNormalize, startRefill } from '../services/taskRunner'

interface ValidationStats {
  complete: number
  missingPhonetic: number
  missingDefinition: number
  duplicates: number
  encodingIssues: number
  otherIssues: number
}

interface ValidationIssue {
  wordId: number
  word: string
  field: string
  issueType: string
  description: string
  currentValue: string | null
  suggestion: string | null
  autoFixable: boolean
}

interface ValidationResult {
  totalWords: number
  checkedAt: string
  stats: ValidationStats
  issues: ValidationIssue[]
}

const ISSUE_LABELS: Record<string, string> = {
  missing_word: '单词为空',
  missing_phonetic: '缺少音标',
  missing_definition: '缺少释义',
  duplicate_word: '重复单词',
  encoding_garbled: '编码问题',
  phonetic_invalid: '音标格式异常',
  definition_mismatch: '释义语言不匹配',
  pos_unknown: '词性未设置',
}

const ISSUE_COLORS: Record<string, string> = {
  missing_word: 'text-red-600 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/40 dark:border-red-800',
  missing_phonetic: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/40 dark:border-yellow-800',
  missing_definition: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-900/40 dark:border-orange-800',
  duplicate_word: 'text-red-600 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/40 dark:border-red-800',
  encoding_garbled: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-900/40 dark:border-purple-800',
  phonetic_invalid: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/40 dark:border-yellow-800',
  definition_mismatch: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/40 dark:border-blue-800',
  pos_unknown: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-300 dark:bg-gray-800/60 dark:border-gray-700',
}

const ISSUE_PAGE_SIZE = 50

export default function DataEditorView() {
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [issuePage, setIssuePage] = useState(1)
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set())
  // 正在编辑的单词（点「手动编辑」时在本页滑出编辑面板）
  const [editWordId, setEditWordId] = useState<number | null>(null)

  // 批量任务全部来自全局 taskStore（切页不中断，回来还能看到进度和结果）
  const tasks = useTaskStore(s => s.tasks)
  const dismissTask = useTaskStore(s => s.dismiss)

  async function handleCheck() {
    setChecking(true)
    try {
      const data = await window.api.checkValidation()
      setResult(data as ValidationResult)
      setIssuePage(1)
      setExpandedIssues(new Set())
    } catch (err) {
      console.error('Validation check failed:', err)
    } finally {
      setChecking(false)
    }
  }

  // 任务完成时自动重新检查，刷新问题列表与统计（本页挂载期间；若任务在其他页面完成，
  // 回到本页的首次渲染同样会触发一次刷新）
  const hasFinishedTask = (['dictFix', 'normalize', 'refill'] as TaskType[])
    .some(t => tasks[t].status === 'done' || tasks[t].status === 'error')
  useEffect(() => {
    if (hasFinishedTask) handleCheck()
  }, [hasFinishedTask])

  function toggleExpand(issueIdx: number) {
    setExpandedIssues(prev => {
      const next = new Set(prev)
      if (next.has(issueIdx)) next.delete(issueIdx)
      else next.add(issueIdx)
      return next
    })
  }

  const filteredIssues = filterType
    ? (result?.issues ?? []).filter(i => i.issueType === filterType)
    : (result?.issues ?? [])

  const totalIssues = result?.issues.length ?? 0
  const filteredTotal = filteredIssues.length
  const totalIssuePages = Math.max(1, Math.ceil(filteredTotal / ISSUE_PAGE_SIZE))
  // 当前页的问题（分页渲染，避免几千条同时出现在页面上）
  const pageIssues = filteredIssues.slice((issuePage - 1) * ISSUE_PAGE_SIZE, issuePage * ISSUE_PAGE_SIZE)

  /** 批量工具的进度条 */
  function ToolProgress({ color, current, total, label }: { color: 'blue' | 'teal'; current: number; total: number; label: string }) {
    const palette = color === 'teal'
      ? { box: 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-900/40', text: 'text-teal-800 dark:text-teal-300', num: 'text-teal-600 dark:text-teal-400', track: 'bg-teal-200 dark:bg-teal-800', bar: 'bg-teal-500' }
      : { box: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300', num: 'text-blue-600 dark:text-blue-400', track: 'bg-blue-200 dark:bg-blue-800', bar: 'bg-blue-500' }
    return (
      <div className={`rounded-lg border p-3 ${palette.box}`}>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className={`font-medium ${palette.text}`}>{label}</span>
          <span className={palette.num}>{current} / {total}</span>
        </div>
        <div className={`h-2 w-full overflow-hidden rounded-full ${palette.track}`}>
          <div className={`h-full rounded-full transition-all duration-300 ${palette.bar}`}
            style={{ width: `${total > 0 ? (current / total) * 100 : 0}%` }} />
        </div>
      </div>
    )
  }

  /** 任务结果横幅（来自全局 store，可关闭） */
  function TaskResultBanner({ type, icon }: { type: TaskType; icon: React.ReactNode }) {
    const t = tasks[type]
    if (t.status !== 'done' && t.status !== 'error') return null
    const label = TASK_LABELS[type]
    if (t.status === 'error') {
      return (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-800 dark:text-red-300">{label}失败</span>
            </div>
            <button onClick={() => dismissTask(type)} className="rounded p-0.5 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1.5 text-sm text-red-700 dark:text-red-400">{t.message || '未知错误'}</div>
        </div>
      )
    }
    return (
      <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium text-green-800 dark:text-green-300">
              {t.message ? `已${label} ${t.message}` : `没有需要${label}的内容`}
            </span>
          </div>
          <button onClick={() => dismissTask(type)} className="rounded p-0.5 text-green-400 hover:bg-green-100 dark:hover:bg-green-900/60">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {t.details.length > 0 && (
          <div className="mt-1.5 max-h-24 overflow-y-auto text-xs text-green-700 dark:text-green-400">
            {t.details.slice(0, 10).map((d, i) => (<p key={i}>• {d}</p>))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="单词检修"
        subtitle="检查和修复单词数据中的问题"
        help={{
          title: '单词检修说明',
          children: (
            <>
              「检查」扫描全部单词，找出缺失、重复、乱码等问题。<br />
              「词典补全」用内置词典（约 77 万词条）填充音标/释义/词性，本地运行、免费、无需联网。<br />
              「音标规范化」给存量音标统一加上 // 并修正特殊字符。<br />
              「等级词频回填」用词典标签填充考试等级与 COCA 词频排名。<br />
              建议顺序：先词典补全 → 再等级词频回填。<br />
              任务运行中可以切换到其他页面，任务会在后台继续，顶部栏有进度提示。
            </>
          )
        }}
        actions={
          <>
            <button
              onClick={handleCheck}
              disabled={checking}
              className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Search className={`h-4 w-4 ${checking ? 'animate-pulse' : ''}`} />
              {checking ? '检查中...' : result ? '重新检查' : '开始检查'}
            </button>
            {result && result.issues.length > 0 && (
              <button
                onClick={() => startDictFix()}
                disabled={tasks.dictFix.status === 'running'}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Zap className={`h-4 w-4 ${tasks.dictFix.status === 'running' ? 'animate-spin' : ''}`} />
                {tasks.dictFix.status === 'running' ? '补全中...' : '词典补全'}
              </button>
            )}
          </>
        }
      />

      {/* 批量工具卡片（不依赖检查结果，随时可用；切页后任务继续） */}
      <SectionCard
        icon={<Slash className="h-5 w-5 text-teal-500" />}
        title="批量工具"
        className="mb-6"
        help={{
          title: '批量工具',
          children: (
            <>
              「音标规范化」：统一补上 // 并修正特殊字符（可以重复运行，无副作用）。<br />
              「等级词频回填」：给没有等级/词频的词补上考试标签与 COCA 排名（已填过的词不受影响）。<br />
              任务运行中可以切换到其他页面，任务在后台继续跑，顶部栏会显示进度。
            </>
          )
        }}
      >
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => startNormalize()}
            disabled={tasks.normalize.status === 'running'}
            className="flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50 dark:border-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
          >
            <Slash className={`h-4 w-4 ${tasks.normalize.status === 'running' ? 'animate-spin' : ''}`} />
            {tasks.normalize.status === 'running' ? '规范化中...' : '音标规范化'}
          </button>
          <button
            onClick={() => startRefill()}
            disabled={tasks.refill.status === 'running'}
            className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
          >
            <Award className={`h-4 w-4 ${tasks.refill.status === 'running' ? 'animate-spin' : ''}`} />
            {tasks.refill.status === 'running' ? '回填中...' : '等级词频回填'}
          </button>
        </div>

        {tasks.normalize.status === 'running' && tasks.normalize.total > 0 && (
          <div className="mt-3">
            <ToolProgress color="teal" current={tasks.normalize.current} total={tasks.normalize.total} label="音标规范化中..." />
          </div>
        )}
        <div className="mt-3 space-y-0">
          <TaskResultBanner type="normalize" icon={<Slash className="h-4 w-4 text-green-600" />} />
          <TaskResultBanner type="refill" icon={<Award className="h-4 w-4 text-green-600" />} />
        </div>

        {tasks.refill.status === 'running' && tasks.refill.total > 0 && (
          <div className="mt-3">
            <ToolProgress color="blue" current={tasks.refill.current} total={tasks.refill.total} label="等级词频回填中..." />
          </div>
        )}
      </SectionCard>

      {/* No validation run yet */}
      {!result && (
        <EmptyState
          icon={<Edit3 className="h-14 w-14" />}
          title="还没有运行数据检查"
          description="点击「开始检查」扫描所有单词数据，发现缺失、重复、格式等问题"
          action={
            <button
              onClick={handleCheck}
              disabled={checking}
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {checking ? '检查中...' : '开始检查'}
            </button>
          }
        />
      )}

      {/* Validation results */}
      {result && (
        <>
          {/* Stats summary */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <div className={`rounded-lg border p-4 ${result.stats.complete > 0 ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/40' : 'border-border bg-card'}`}>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="mt-1 text-2xl font-bold text-green-900 dark:text-green-300">{result.stats.complete}</p>
              <p className="text-xs text-green-700 dark:text-green-400">数据完整</p>
            </div>
            <div className={`rounded-lg border p-4 ${result.stats.missingPhonetic > 0 ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/40' : 'border-border bg-card'}`}>
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="mt-1 text-2xl font-bold text-yellow-900 dark:text-yellow-300">{result.stats.missingPhonetic}</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">缺少音标</p>
            </div>
            <div className={`rounded-lg border p-4 ${result.stats.missingDefinition > 0 ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/40' : 'border-border bg-card'}`}>
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <p className="mt-1 text-2xl font-bold text-orange-900 dark:text-orange-300">{result.stats.missingDefinition}</p>
              <p className="text-xs text-orange-700 dark:text-orange-400">缺少释义</p>
            </div>
            <div className={`rounded-lg border p-4 ${(result.stats.duplicates + result.stats.encodingIssues + result.stats.otherIssues) > 0 ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/40' : 'border-border bg-card'}`}>
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="mt-1 text-2xl font-bold text-red-900 dark:text-red-300">
                {result.stats.duplicates + result.stats.encodingIssues + result.stats.otherIssues}
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">其他问题</p>
            </div>
          </div>

          {/* 词典补全进度与结果（全局任务） */}
          {tasks.dictFix.status === 'running' && tasks.dictFix.total > 0 && (
            <div className="mb-4">
              <ToolProgress color="blue" current={tasks.dictFix.current} total={tasks.dictFix.total} label="词典补全中..." />
            </div>
          )}
          <div className="space-y-0">
            <TaskResultBanner type="dictFix" icon={<Zap className="h-4 w-4 text-green-600" />} />
          </div>

          {/* All clear */}
          {totalIssues === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-green-200 bg-green-50 py-16 dark:border-green-800 dark:bg-green-900/40">
              <CheckCircle2 className="mb-3 h-14 w-14 text-green-500" />
              <p className="text-lg font-semibold text-green-800 dark:text-green-300">数据一切正常！</p>
              <p className="text-sm text-green-700 dark:text-green-400">
                共检查 {result.totalWords} 个单词，没有发现问题
              </p>
            </div>
          ) : (
            <>
              {/* Filter tabs */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => { setFilterType(null); setIssuePage(1) }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterType === null
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  全部 ({totalIssues})
                </button>
                {Object.entries(ISSUE_LABELS).map(([type, label]) => {
                  const count = result.issues.filter(i => i.issueType === type).length
                  if (count === 0) return null
                  return (
                    <button
                      key={type}
                      onClick={() => { setFilterType(type); setIssuePage(1) }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        filterType === type
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  )
                })}
              </div>

              {/* Issues list（分页，每页 50 条） */}
              <div className="rounded-lg border border-border">
                <div className="border-b border-border bg-muted/50 px-4 py-3">
                  <h3 className="font-semibold">
                    问题列表
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      （共 {filteredTotal} 个，第 {Math.min(issuePage, totalIssuePages)}/{totalIssuePages} 页）
                    </span>
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {pageIssues.map((issue, idx) => {
                    const globalIdx = (issuePage - 1) * ISSUE_PAGE_SIZE + idx
                    return (
                      <div key={`${issue.wordId}-${issue.field}-${globalIdx}`} className="px-4 py-3 hover:bg-accent/20">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Expand toggle */}
                            <button
                              onClick={() => toggleExpand(globalIdx)}
                              className="mt-0.5 shrink-0"
                            >
                              {expandedIssues.has(globalIdx)
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              }
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{issue.word}</span>
                                <span className={`rounded border px-1.5 py-0.5 text-xs ${ISSUE_COLORS[issue.issueType] ?? 'bg-muted'}`}>
                                  {ISSUE_LABELS[issue.issueType] ?? issue.issueType}
                                </span>
                                {issue.autoFixable && (
                                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                    可自动修复
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-sm text-muted-foreground">{issue.description}</p>

                              {/* Expanded details */}
                              {expandedIssues.has(globalIdx) && (
                                <div className="mt-2 space-y-1 rounded bg-muted/50 p-3 text-sm">
                                  <p>
                                    <span className="text-muted-foreground">字段：</span>
                                    {issue.field}
                                  </p>
                                  {issue.currentValue && (
                                    <p>
                                      <span className="text-muted-foreground">当前值：</span>
                                      <code className="rounded bg-muted px-1 text-xs">{issue.currentValue}</code>
                                    </p>
                                  )}
                                  {issue.suggestion && (
                                    <p>
                                      <span className="text-muted-foreground">建议：</span>
                                      <span className="text-green-700 dark:text-green-400">{issue.suggestion}</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick action：直接在本页滑出编辑面板，不再跳转 */}
                          <button
                            onClick={() => setEditWordId(issue.wordId)}
                            className="shrink-0 rounded-md border border-input px-2.5 py-1 text-xs hover:bg-accent ml-3"
                          >
                            手动编辑
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 问题分页 */}
                {totalIssuePages > 1 && (
                  <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm text-muted-foreground">
                    <span>第 {Math.min(issuePage, totalIssuePages)}/{totalIssuePages} 页</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setIssuePage(p => Math.max(1, p - 1))} disabled={issuePage === 1}
                        className="flex items-center gap-0.5 rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
                        <ChevronLeft className="h-3.5 w-3.5" />上一页
                      </button>
                      <button onClick={() => setIssuePage(p => Math.min(totalIssuePages, p + 1))} disabled={issuePage === totalIssuePages}
                        className="rounded-md border border-border px-2 py-1.5 text-xs disabled:opacity-30 hover:bg-accent transition-colors">
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* 单词编辑面板（点「手动编辑」时在本页滑出） */}
      {editWordId !== null && (
        <WordDetailPanel
          wordId={editWordId}
          onClose={() => setEditWordId(null)}
          onSaved={async () => {
            // 保存后重新检查，刷新问题列表和统计
            try {
              const updated = await window.api.checkValidation()
              setResult(updated as ValidationResult)
            } catch (err) {
              console.error('Re-validation failed:', err)
            }
          }}
        />
      )}
    </div>
  )
}
