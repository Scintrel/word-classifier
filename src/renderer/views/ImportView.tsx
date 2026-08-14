import { useState, useEffect } from 'react'
import {
  CheckCircle2, XCircle, AlertCircle, Loader2,
  FileText, Clock
} from 'lucide-react'
import FileDropZone from '../components/FileDropZone'
import ColumnMapper from '../components/ColumnMapper'
import HelpTip from '../components/HelpTip'
import PageHeader from '../components/PageHeader'
import type { FilePreview, ColumnMapping, ImportResult } from '../../preload/index'

/**
 * Steps in the import workflow.
 */
type ImportStep = 'select' | 'preview' | 'mapping' | 'importing' | 'done'

/**
 * ImportView - 导入单词页面
 *
 * Full import workflow:
 * 1. Select file (drag-drop or click)
 * 2. Preview the parsed data
 * 3. Map columns to word fields
 * 4. Import with progress feedback
 */
export default function ImportView({ active = true }: { active?: boolean }) {
  // State
  const [step, setStep] = useState<ImportStep>('select')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [bareWordsMode, setBareWordsMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importHistory, setImportHistory] = useState<unknown[]>([])

  async function loadImportHistory() {
    try {
      const history = await window.api.getImportHistory()
      setImportHistory(history)
    } catch (err) {
      console.error('加载导入历史失败:', err)
    }
  }

  // 打开页面即加载历史（切页回来时刷新——页面常驻，历史保持最新）
  useEffect(() => {
    if (active) loadImportHistory()
  }, [active])

  /**
   * Step 1 → Step 2: File selected, parse it for preview.
   */
  async function handleFileSelected(path: string, name: string) {
    if (!path) {
      // User cleared selection
      setFilePath(null)
      setFileName(null)
      setPreview(null)
      setStep('select')
      return
    }

    setFilePath(path)
    setFileName(name)
    setError(null)

    try {
      const result = await window.api.parseFile(path)
      setPreview(result)
      setStep('preview')
    } catch (err) {
      setError(`解析文件失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  /**
   * Step 2 → Step 3: User wants to proceed from preview to mapping.
   */
  function handleStartMapping() {
    if (bareWordsMode && preview) {
      // Skip mapping — use first column as word, import directly
      const firstCol = preview.headers[0] || 'word'
      handleConfirmMapping({ word: firstCol })
    } else {
      setStep('mapping')
    }
  }

  /**
   * Step 3 → Step 4: User confirmed column mapping, run the import.
   */
  async function handleConfirmMapping(mapping: ColumnMapping) {
    if (!filePath) return

    setStep('importing')
    setError(null)

    try {
      const result = await window.api.runImport(filePath, mapping)
      setImportResult(result)
      setStep('done')

      // Refresh import history
      await loadImportHistory()
    } catch (err) {
      setError(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`)
      setStep('mapping') // Go back so user can retry
    }
  }

  /**
   * Reset everything to start a new import.
   */
  function handleReset() {
    setStep('select')
    setFilePath(null)
    setFileName(null)
    setPreview(null)
    setImportResult(null)
    setError(null)
  }

  return (
    <div>
      <PageHeader
        title="导入单词"
        subtitle="上传你的单词表文件，程序会自动解析、校验并导入"
      />

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
          <XCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        {[
          { s: 'select', label: '选择文件' },
          { s: 'preview', label: '预览数据' },
          { s: 'mapping', label: '列映射' },
          { s: 'done', label: '完成' },
        ].map(({ s, label }, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              step === s
                ? 'bg-primary text-primary-foreground'
                : step === 'done' && i <= 3
                  ? 'bg-green-500 text-white'
                  : step === 'importing' && i === 3
                    ? 'bg-primary text-primary-foreground animate-pulse'
                    : step === 'mapping' && i === 2
                      ? 'bg-primary text-primary-foreground'
                      : step === 'preview' && i === 1
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
            }`}>
              {step === 'done' && i < 3 ? '✓' : i + 1}
            </div>
            <span className={`${
              step === s || (step === 'done' && i <= 3)
                ? 'font-medium text-foreground'
                : 'text-muted-foreground'
            }`}>
              {label}
            </span>
            {i < 3 && <div className="mx-1 h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {/* ============================================
            Step 1: File Selection
            ============================================ */}
        {(step === 'select' || step === 'mapping' || step === 'importing') && (
          <>
            {/* Bare-words toggle */}
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={bareWordsMode} onChange={e => setBareWordsMode(e.target.checked)} className="peer sr-only" />
                <div className="h-6 w-11 rounded-full bg-muted peer-checked:bg-purple-500 peer-focus:ring-2 peer-focus:ring-purple-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
              </label>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">纯单词模式</span>
                  <HelpTip title="纯单词模式">
                    如果文件只有一列单词（每行一个），勾选后可以跳过「列映射」直接导入。<br />
                    导入后单词只有拼写，音标和释义可到「单词检修」页用「词典补全」免费填充（无需联网），或用「AI 补全」生成更详细的信息。
                  </HelpTip>
                </div>
                <p className="text-xs text-muted-foreground">文件只包含单词列，导入后使用词典或 AI 补全音标和释义</p>
              </div>
            </div>
            <FileDropZone
              onFileSelected={handleFileSelected}
              selectedFile={step === 'select' ? fileName : null}
            />
          </>
        )}

        {step === 'select' && fileName && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            文件 "{fileName}" 已选择，正在解析...
          </div>
        )}

        {/* ============================================
            Step 2: Preview parsed data
            ============================================ */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            {/* File info bar */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <span className="font-medium">{fileName}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({preview.format.toUpperCase()}, {preview.totalRows} 行数据
                    {preview.encoding ? `, ${preview.encoding} 编码` : ''})
                  </span>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                换文件
              </button>
            </div>

            {/* Data preview table */}
            <div className="rounded-lg border border-border">
              <div className="border-b border-border bg-muted/50 px-4 py-3">
                <h3 className="font-semibold">
                  数据预览
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    （显示前 {preview.previewRows.length} 行，共 {preview.totalRows} 行）
                  </span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                      {preview.headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-border hover:bg-accent/30">
                        <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                        {preview.headers.map((h) => (
                          <td key={h} className="px-3 py-2 max-w-[200px] truncate whitespace-nowrap">
                            {row[h] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action button */}
            <div className="flex justify-end">
              <button
                onClick={handleStartMapping}
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {bareWordsMode ? '确认数据，直接导入 →' : '确认数据，开始列映射 →'}
              </button>
            </div>
          </div>
        )}

        {/* ============================================
            Step 3: Column Mapping
            ============================================ */}
        {step === 'mapping' && preview && (
          <div>
            <div className="mb-3 flex items-center gap-1.5">
              <span className="text-sm font-medium">把文件里的列对应到单词字段</span>
              <HelpTip title="列映射说明">
                列映射就是告诉程序：文件里哪一列是单词、哪一列是音标、哪一列是释义。<br />
                程序会先自动猜一个匹配，你可以用每列的下拉框调整。<br />
                没有的字段选择「不使用」即可。
              </HelpTip>
            </div>
            <ColumnMapper
              headers={preview.headers}
              onConfirm={handleConfirmMapping}
              onBack={() => setStep('preview')}
            />
          </div>
        )}

        {/* ============================================
            Step 4: Importing (progress)
            ============================================ */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border py-16">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">正在导入...</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              正在将 {preview?.totalRows ?? 0} 条数据导入数据库，请稍候
            </p>
          </div>
        )}

        {/* ============================================
            Step 5: Done — import results
            ============================================ */}
        {step === 'done' && importResult && (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/40">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
                  导入完成！
                </h3>
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                  成功导入 {importResult.imported} 个单词
                  {importResult.skipped > 0 && `，跳过 ${importResult.skipped} 个重复`}
                </p>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/40">
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">{importResult.imported}</p>
                <p className="text-sm text-green-600 dark:text-green-400">成功导入</p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-900/40">
                <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">{importResult.skipped}</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">跳过(重复)</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-900/40">
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{importResult.warnings}</p>
                <p className="text-sm text-blue-600 dark:text-blue-400">警告</p>
              </div>
            </div>

            {/* Warning messages */}
            {importResult.messages.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/40">
                <div className="mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800 dark:text-yellow-300">导入提示</span>
                </div>
                <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-400">
                  {importResult.messages.map((msg, i) => (
                    <li key={i}>• {msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                继续导入新文件
              </button>
              <button
                onClick={() => {
                  // Navigate to word list using hash router
                  window.location.hash = '#/words'
                }}
                className="rounded-md border border-input px-6 py-2.5 text-sm font-medium hover:bg-accent"
              >
                查看单词列表 →
              </button>
            </div>
            {/* Bare-words prompt */}
            {importResult && importResult.imported > 0 && bareWordsMode && (
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-5 dark:border-purple-800 dark:bg-purple-900/40">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{'🤖'}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-300">检测到纯单词导入</h4>
                    <p className="mt-1 text-sm text-purple-700 dark:text-purple-400">
                      已导入 {importResult.imported} 个单词，但只有拼写没有音标和释义。可到「单词检修」页用词典补全（免费、无需联网），或用 AI 自动补全。
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => window.location.hash = '#/editor'}
                        className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
                        去单词检修补全 →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import history (always visible below) */}
      {step !== 'importing' && (
        <div className="mt-8 rounded-lg border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">导入历史</h3>
          </div>
          {importHistory.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              还没有导入记录。上传你的第一个单词表文件开始吧！
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(importHistory as Array<Record<string, unknown>>).map((record) => (
                <div
                  key={record.id as number}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{record.file_name as string}</span>
                    <span className="text-muted-foreground">
                      ({record.rows_imported as number} 词 / {record.file_format as string})
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {record.imported_at as string}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
