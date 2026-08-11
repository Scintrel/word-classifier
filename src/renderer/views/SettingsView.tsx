import { useState, useEffect } from 'react'
import { Settings, Sun, Moon, Monitor, FileDown, Database, Cpu, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

/**
 * SettingsView - 设置页面
 *
 * App preferences: theme, language, export format,
 * classification settings, and data management.
 */
export default function SettingsView() {
  const [theme, setTheme] = useState('system')
  const [language, setLanguage] = useState('zh')
  const [exportFormat, setExportFormat] = useState('csv')

  // AI config
  const [aiProvider, setAiProvider] = useState('ollama')
  const [aiOllamaUrl, setAiOllamaUrl] = useState('http://localhost:11434')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('deepseek-chat')
  const [testingAI, setTestingAI] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savingAI, setSavingAI] = useState(false)

  useEffect(() => {
    loadAIConfig()
  }, [])

  async function loadAIConfig() {
    try {
      const cfg = await window.api.getAIConfig()
      if (cfg.provider) setAiProvider(cfg.provider)
      if (cfg.ollamaUrl) setAiOllamaUrl(cfg.ollamaUrl)
      if (cfg.apiKey) setAiApiKey(cfg.apiKey)
      if (cfg.model) setAiModel(cfg.model)
    } catch {}
  }

  async function handleTestAI() {
    setTestingAI(true); setTestResult(null)
    try {
      // Save config first
      await window.api.saveAIConfig({ provider: aiProvider, ollama_url: aiOllamaUrl, api_key: aiApiKey, model: aiModel })
      const result = await window.api.testAIConnection()
      setTestResult(result)
    } catch (err) { setTestResult({ ok: false, message: String(err) }) }
    finally { setTestingAI(false) }
  }

  async function handleSaveAI() {
    setSavingAI(true)
    try {
      await window.api.saveAIConfig({ provider: aiProvider, ollama_url: aiOllamaUrl, api_key: aiApiKey, model: aiModel })
      setTestResult({ ok: true, message: '配置已保存' })
    } catch (err) { setTestResult({ ok: false, message: String(err) }) }
    finally { setSavingAI(false) }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">设置</h1>
      <p className="mb-6 text-muted-foreground">
        自定义应用的行为和外观
      </p>

      {/* Theme */}
      <section className="mb-6 rounded-lg border border-border p-5">
        <div className="mb-4 flex items-center gap-3">
          <Monitor className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">外观主题</h2>
        </div>
        <div className="flex gap-3">
          {[
            { value: 'light', label: '浅色', icon: Sun },
            { value: 'dark', label: '深色', icon: Moon },
            { value: 'system', label: '跟随系统', icon: Monitor },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
                theme === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Language */}
      <section className="mb-6 rounded-lg border border-border p-5">
        <div className="mb-4 flex items-center gap-3">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">界面语言</h2>
        </div>
        <div className="flex gap-3">
          {[
            { value: 'zh', label: '中文' },
            { value: 'en', label: 'English' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLanguage(value)}
              className={`rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
                language === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Export */}
      <section className="mb-6 rounded-lg border border-border p-5">
        <div className="mb-4 flex items-center gap-3">
          <FileDown className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">导出格式</h2>
        </div>
        <div className="flex gap-3">
          {[
            { value: 'csv', label: 'CSV' },
            { value: 'xlsx', label: 'Excel' },
            { value: 'json', label: 'JSON' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setExportFormat(value)}
              className={`rounded-md border px-4 py-2.5 text-sm font-medium transition-colors ${
                exportFormat === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Classification settings */}
      <section className="mb-6 rounded-lg border border-border p-5">
        <div className="mb-4 flex items-center gap-3">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">分类设置</h2>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" defaultChecked className="h-4 w-4 rounded" />
          <div>
            <p className="font-medium">导入后自动分类</p>
            <p className="text-muted-foreground">
              导入单词后自动运行语义分类（推荐开启）
            </p>
          </div>
        </label>
      </section>

      {/* AI Configuration */}
      <section className="mb-6 rounded-lg border border-border p-5">
        <div className="mb-4 flex items-center gap-3">
          <Cpu className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">AI 模型配置</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          使用大模型自动补全单词信息（音标、释义、例句）和智能分类。支持本地 Ollama 和 DeepSeek API。
        </p>

        <div className="space-y-3">
          {/* Provider */}
          <div>
            <label className="mb-1 block text-sm font-medium">AI 服务</label>
            <div className="flex gap-2">
              {[
                { v: 'ollama', label: 'Ollama (本地)' },
                { v: 'deepseek', label: 'DeepSeek API (云端)' },
              ].map(({ v, label }) => (
                <button key={v} onClick={() => setAiProvider(v)}
                  className={`rounded-md border px-4 py-2 text-sm ${aiProvider === v ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-accent'}`}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Ollama URL */}
          {aiProvider === 'ollama' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Ollama 地址</label>
              <input type="text" value={aiOllamaUrl} onChange={e => setAiOllamaUrl(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
          )}

          {/* Model name */}
          <div>
            <label className="mb-1 block text-sm font-medium">模型名称</label>
            <input type="text" value={aiModel} onChange={e => setAiModel(e.target.value)}
              placeholder={aiProvider === 'ollama' ? '例如: qwen2.5:7b' : '例如: deepseek-chat'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </div>

          {/* API Key (DeepSeek only) */}
          {aiProvider === 'deepseek' && (
            <div>
              <label className="mb-1 block text-sm font-medium">DeepSeek API Key</label>
              <input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
          )}
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mt-3 flex items-center gap-2 rounded-md p-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {testResult.message}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button onClick={handleTestAI} disabled={testingAI}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {testingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            测试连接
          </button>
          <button onClick={handleSaveAI} disabled={savingAI}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent">
            {savingAI ? '保存中...' : '保存配置'}
          </button>
        </div>
      </section>

      {/* Export section */}
      <section className="mb-6 rounded-lg border border-border p-5">
        <div className="mb-4 flex items-center gap-3">
          <FileDown className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">导出数据</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          将分类好的单词表导出为 JSON 文件。
        </p>
        <button
          onClick={async () => {
            try {
              const words = await window.api.exportWords()
              const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = 'words-all.json'; a.click()
              URL.revokeObjectURL(url)
            } catch (err) { console.error('Export failed:', err) }
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          导出全部单词 (JSON)
        </button>
      </section>

      {/* Data management */}
      <section className="rounded-lg border border-red-200 bg-red-50 p-5">
        <div className="mb-4 flex items-center gap-3">
          <Database className="h-5 w-5 text-red-600" />
          <h2 className="font-semibold text-red-900">数据管理</h2>
        </div>
        <p className="mb-3 text-sm text-red-700">
          以下操作不可撤销，请谨慎使用。
        </p>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              if (!confirm('确定要删除所有单词吗？此操作不可撤销！')) return
              if (!confirm('再次确认：真的要清空所有单词数据吗？')) return
              try {
                await window.api.clearWords()
                alert('所有单词已清空')
              } catch (err) { console.error('Failed:', err); alert('清空失败') }
            }}
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            清空所有单词
          </button>
          <button
            onClick={async () => {
              if (!confirm('确定要重置所有分类为默认值吗？这将清空所有单词的分类关联。')) return
              try {
                await window.api.resetCategories()
                alert('分类已重置为默认值')
              } catch (err) { console.error('Failed:', err); alert('重置失败') }
            }}
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            重置为默认分类
          </button>
        </div>
      </section>
    </div>
  )
}
