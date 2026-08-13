import { useState } from 'react'
import {
  Edit3, AlertTriangle, AlertCircle, CheckCircle2,
  Search, XCircle, Zap, ChevronDown, ChevronRight, Cpu
} from 'lucide-react'
import WordDetailPanel from '../components/WordDetailPanel'

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
  missing_word: 'text-red-600 bg-red-50 border-red-200',
  missing_phonetic: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  missing_definition: 'text-orange-600 bg-orange-50 border-orange-200',
  duplicate_word: 'text-red-600 bg-red-50 border-red-200',
  encoding_garbled: 'text-purple-600 bg-purple-50 border-purple-200',
  phonetic_invalid: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  definition_mismatch: 'text-blue-600 bg-blue-50 border-blue-200',
  pos_unknown: 'text-gray-600 bg-gray-50 border-gray-200',
}

export default function DataEditorView() {
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [dictProgress, setDictProgress] = useState({ current: 0, total: 0 })
  const [fixResult, setFixResult] = useState<{ fixed: number; details: string[] } | null>(null)
  const [aiFixing, setAiFixing] = useState(false)
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 })
  const [aiFixResult, setAiFixResult] = useState<{ filled: number; words: string[] } | null>(null)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set())
  // 正在编辑的单词（点「手动编辑」时在本页滑出编辑面板）
  const [editWordId, setEditWordId] = useState<number | null>(null)

  async function handleCheck() {
    setChecking(true)
    setFixResult(null)
    try {
      const data = await window.api.checkValidation()
      setResult(data as ValidationResult)
    } catch (err) {
      console.error('Validation check failed:', err)
    } finally {
      setChecking(false)
    }
  }

  async function handleAutoFix() {
    setFixing(true)
    setFixResult(null)
    try {
      const total = await window.api.autoFixCount()
      if (total === 0) { setFixResult({ fixed: 0, details: [] }); setFixing(false); return }
      setDictProgress({ current: 0, total })
      let allDetails: string[] = []
      let totalFixed = 0
      let attempts = 0
      // 防卡死：最多循环"总单词数/每批300"批 + 2 批余量
      const maxAttempts = Math.ceil(total / 300) + 2
      while (attempts < maxAttempts) {
        const data = await window.api.autoFixBatch(300)
        // 词典未加载的错误（fixed = -1），直接显示错误并退出
        if (data.fixed === -1) { setFixResult({ fixed: -1, details: data.details }); break }
        totalFixed += data.fixed
        allDetails = [...allDetails, ...data.details]
        setDictProgress({ current: totalFixed, total })
        attempts++
        if (data.done) break
        // 本批没有进展，避免无限循环
        if (data.fixed === 0 && attempts > 1) break
      }
      if (totalFixed >= 0) {
        setFixResult({ fixed: totalFixed, details: allDetails })
        const updated = await window.api.checkValidation()
        setResult(updated as ValidationResult)
      }
    } catch (err) {
      console.error('Auto-fix failed:', err)
    } finally {
      setFixing(false)
    }
  }

  async function handleAIAutoFill() {
    setAiFixing(true)
    setAiFixResult(null)
    try {
      const total = await window.api.aiAutoFillCount()
      if (total === 0) {
        setAiFixResult({ filled: 0, words: [] })
        setAiFixing(false)
        return
      }
      setAiProgress({ current: 0, total })
      let allWords: string[] = []
      let totalFilled = 0
      let attempts = 0
      const maxAttempts = Math.ceil(total / 8) + 2
      while (attempts < maxAttempts) {
        const data = await window.api.aiAutoFillAll(8)
        totalFilled += data.filled
        allWords = [...allWords, ...data.words]
        setAiProgress({ current: totalFilled, total })
        attempts++
        if (data.done) break
        // If no progress in this batch, don't retry infinitely
        if (data.filled === 0 && attempts > 1) break
      }
      setAiFixResult({ filled: totalFilled, words: allWords })
      if (totalFilled > 0) {
        const updated = await window.api.checkValidation()
        setResult(updated as ValidationResult)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiFixResult({ filled: -1, words: [msg] })
    } finally {
      setAiFixing(false)
    }
  }

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">单词检修</h1>
          <p className="text-muted-foreground">
            检查和修复单词数据中的问题
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <Search className={`h-4 w-4 ${checking ? 'animate-pulse' : ''}`} />
            {checking ? '检查中...' : result ? '重新检查' : '开始检查'}
          </button>
          {result && result.issues.length > 0 && (
            <>
              <button
                onClick={handleAutoFix}
                disabled={fixing}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Zap className={`h-4 w-4 ${fixing ? 'animate-spin' : ''}`} />
                {fixing ? '修复中...' : '词典补全'}
              </button>
              <button
                onClick={handleAIAutoFill}
                disabled={aiFixing}
                className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                <Cpu className={`h-4 w-4 ${aiFixing ? 'animate-spin' : ''}`} />
                {aiFixing ? 'AI补全中...' : 'AI 智能补全'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* No validation run yet */}
      {!result && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border py-20">
          <Edit3 className="mb-4 h-14 w-14 text-muted-foreground/20" />
          <p className="mb-1 text-muted-foreground">还没有运行数据检查</p>
          <p className="mb-6 text-sm text-muted-foreground/70">
            点击「开始检查」扫描所有单词数据，发现缺失、重复、格式等问题
          </p>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {checking ? '检查中...' : '开始检查'}
          </button>
        </div>
      )}

      {/* Validation results */}
      {result && (
        <>
          {/* Stats summary */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            <div className={`rounded-lg border p-4 ${result.stats.complete > 0 ? 'border-green-200 bg-green-50' : 'border-border'}`}>
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="mt-1 text-2xl font-bold text-green-900">{result.stats.complete}</p>
              <p className="text-xs text-green-700">数据完整</p>
            </div>
            <div className={`rounded-lg border p-4 ${result.stats.missingPhonetic > 0 ? 'border-yellow-200 bg-yellow-50' : 'border-border'}`}>
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="mt-1 text-2xl font-bold text-yellow-900">{result.stats.missingPhonetic}</p>
              <p className="text-xs text-yellow-700">缺少音标</p>
            </div>
            <div className={`rounded-lg border p-4 ${result.stats.missingDefinition > 0 ? 'border-orange-200 bg-orange-50' : 'border-border'}`}>
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <p className="mt-1 text-2xl font-bold text-orange-900">{result.stats.missingDefinition}</p>
              <p className="text-xs text-orange-700">缺少释义</p>
            </div>
            <div className={`rounded-lg border p-4 ${(result.stats.duplicates + result.stats.encodingIssues + result.stats.otherIssues) > 0 ? 'border-red-200 bg-red-50' : 'border-border'}`}>
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="mt-1 text-2xl font-bold text-red-900">
                {result.stats.duplicates + result.stats.encodingIssues + result.stats.otherIssues}
              </p>
              <p className="text-xs text-red-700">其他问题</p>
            </div>
          </div>

          {/* Dict progress */}
          {fixing && dictProgress.total > 0 && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-blue-800">词典补全中...</span>
                <span className="text-blue-600">{dictProgress.current} / {dictProgress.total}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-blue-200">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(dictProgress.current / dictProgress.total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Fix result message */}
          {fixResult && fixResult.fixed === -1 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium text-red-800">词典补全失败</span>
              </div>
              <div className="mt-2 text-sm text-red-700">
                {fixResult.details[0] || '未知错误'}
              </div>
            </div>
          )}
          {fixResult && fixResult.fixed >= 0 && (
            <div className={`mb-4 rounded-lg p-4 ${fixResult.fixed > 0 ? 'bg-green-50 border border-green-200' : 'bg-muted border border-border'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">
                  {fixResult.fixed > 0
                    ? `已词典补全 ${fixResult.fixed} 个单词`
                    : '没有需要词典补全的内容'}
                </span>
              </div>
              {fixResult.details.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto text-sm text-green-700">
                  {fixResult.details.slice(0, 20).map((d, i) => (<p key={i}>• {d}</p>))}
                </div>
              )}
            </div>
          )}

          {/* AI progress */}
          {aiFixing && aiProgress.total > 0 && (
            <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-purple-800">AI 补全中...</span>
                <span className="text-purple-600">{aiProgress.current} / {aiProgress.total}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-purple-200">
                <div className="h-full rounded-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${(aiProgress.current / aiProgress.total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* AI fix result — error */}
          {aiFixResult && aiFixResult.filled === -1 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium text-red-800">AI 补全失败</span>
              </div>
              <div className="mt-2 text-sm text-red-700">
                错误: {aiFixResult.words[0] || '未知错误'}<br />
                请确保已在「设置」中配置 AI 并测试连接通过后再试。
              </div>
            </div>
          )}
          {/* AI fix result — nothing to fix */}
          {aiFixResult && aiFixResult.filled === 0 && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">没有需要AI补全的单词</span>
              </div>
              <p className="mt-1 text-sm text-yellow-700">所有单词已包含完整信息。</p>
            </div>
          )}
          {/* AI fix result — success */}
          {aiFixResult && aiFixResult.filled > 0 && (
            <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-purple-600" />
                <span className="font-medium text-purple-800">AI 已补全 {aiFixResult.filled} 个单词</span>
              </div>
              {aiFixResult.words.length > 0 && (
                <div className="mt-2 text-sm text-purple-700">
                  已补全: {aiFixResult.words.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* All clear */}
          {totalIssues === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-green-200 bg-green-50 py-16">
              <CheckCircle2 className="mb-3 h-14 w-14 text-green-500" />
              <p className="text-lg font-semibold text-green-800">数据一切正常！</p>
              <p className="text-sm text-green-700">
                共检查 {result.totalWords} 个单词，没有发现问题
              </p>
            </div>
          ) : (
            <>
              {/* Filter tabs */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterType(null)}
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
                      onClick={() => setFilterType(type)}
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

              {/* Issues list */}
              <div className="rounded-lg border border-border">
                <div className="border-b border-border bg-muted/50 px-4 py-3">
                  <h3 className="font-semibold">
                    问题列表
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({filteredIssues.length} 个问题)
                    </span>
                  </h3>
                </div>
                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {filteredIssues.map((issue, idx) => (
                    <div key={`${issue.wordId}-${issue.field}-${idx}`} className="px-4 py-3 hover:bg-accent/20">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Expand toggle */}
                          <button
                            onClick={() => toggleExpand(idx)}
                            className="mt-0.5 shrink-0"
                          >
                            {expandedIssues.has(idx)
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
                                <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                                  可自动修复
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">{issue.description}</p>

                            {/* Expanded details */}
                            {expandedIssues.has(idx) && (
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
                                    <span className="text-green-700">{issue.suggestion}</span>
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
                  ))}
                </div>
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
