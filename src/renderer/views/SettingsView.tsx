import { useState, useEffect } from 'react'
import {
  Settings, Sun, Moon, Monitor, FileDown, Database, Cpu,
  CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight
} from 'lucide-react'
import HelpTip from '../components/HelpTip'
import SectionCard from '../components/SectionCard'
import { LEVEL_DEFS, FREQ_BANDS } from '../constants/wordMeta'
import { useDevStore } from '../stores/devStore'

/**
 * SettingsView - 设置页面
 *
 * App preferences: theme, language, export format,
 * classification settings, and data management.
 * 所有设置通过 settings 表持久化，重启应用后依然生效。
 */
export default function SettingsView() {
  const [theme, setTheme] = useState('system')
  const [language, setLanguage] = useState('zh')
  const [exportFormat, setExportFormat] = useState('csv')
  const [autoClassify, setAutoClassify] = useState(true)
  // 导出筛选
  const [exportLevel, setExportLevel] = useState('all')
  const [exportFreq, setExportFreq] = useState('all')

  // AI config
  const [aiProvider, setAiProvider] = useState('ollama')
  const [aiOllamaUrl, setAiOllamaUrl] = useState('http://localhost:11434')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('deepseek-chat')
  const [testingAI, setTestingAI] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [savingAI, setSavingAI] = useState(false)
  // AI 配置区默认折叠，减少页面长度
  const [aiOpen, setAiOpen] = useState(false)
  // 开发者模式开关（与侧边栏入口共用状态）
  const devEnabled = useDevStore(s => s.enabled)
  const setDevEnabled = useDevStore(s => s.setEnabled)

  useEffect(() => {
    loadAIConfig()
    loadAppSettings()
    // 加载开发者模式开关状态
    window.api.getSetting('dev_mode').then(v => setDevEnabled(v === 'true'))
  }, [])

  async function loadAIConfig() {
    try {
      const cfg = await window.api.getAIConfig()
      if (cfg.provider) setAiProvider(cfg.provider)
      if (cfg.ollamaUrl) setAiOllamaUrl(cfg.ollamaUrl)
      if (cfg.apiKey) setAiApiKey(cfg.apiKey)
      if (cfg.model) setAiModel(cfg.model)
    } catch (err) {
      // 加载失败不阻塞页面，但记录日志方便排查
      console.error('加载 AI 配置失败:', err)
    }
  }

  // 从数据库 settings 表加载应用偏好（主题/语言/导出格式/自动分类）
  async function loadAppSettings() {
    try {
      const all = await window.api.getAllSettings()
      if (all.theme) setTheme(all.theme)
      if (all.language) setLanguage(all.language)
      if (all.export_format) setExportFormat(all.export_format)
      if (all.auto_classify !== undefined) setAutoClassify(all.auto_classify === 'true')
    } catch (err) {
      console.error('加载应用设置失败:', err)
    }
  }

  // 切换主题：立即生效（和顶部栏的月亮按钮用同一套机制）+ 存库
  function applyTheme(value: string) {
    setTheme(value)
    window.api.setSetting('theme', value)
    if (value === 'dark') {
      document.documentElement.classList.add('dark')
      localStorage.setItem('app-theme', 'dark')
    } else if (value === 'light') {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('app-theme', 'light')
    } else {
      // 跟随系统：按系统当前设置切换
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      document.documentElement.classList.toggle('dark', mq.matches)
      localStorage.setItem('app-theme', 'system')
    }
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

  /** 行内选择按钮组（主题/语言/导出格式共用） */
  function ChoiceRow({ value, onChange, options }: {
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[]
  }) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map(({ value: v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors ${
              value === v
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
          </button>
        ))}
      </div>
    )
  }

  async function handleExport() {
    try {
      const words = await window.api.exportWords({
        difficulty: exportLevel !== 'all' ? exportLevel : undefined,
        frequency: exportFreq !== 'all' ? exportFreq : undefined
      })
      let blob: Blob
      let fileName: string
      if (exportFormat === 'json') {
        // JSON：结构化格式，适合程序读取或备份
        blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' })
        fileName = 'words-all.json'
      } else {
        // CSV（含 xlsx 选择）：Excel 和各类表格软件都能直接打开
        const esc = (v: unknown) => {
          const s = String(v ?? '')
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        }
        // 等级列：标签转中文（zk→初中 等），便于直接阅读
        const levelToText = (d: unknown) => {
          const s = String(d ?? '')
          if (!s || s === 'none' || s === 'unknown') return '其他'
          return s.split(',').map(t => t.trim())
            .map(t => LEVEL_DEFS.find(x => x.key === t)?.label ?? t).join('、')
        }
        const headers = ['单词', '英式音标', '美式音标', '词性', '中文释义', '英文释义', '等级', '词频排名', '分类']
        const lines = [headers.join(',')]
        for (const w of words) {
          lines.push([w.word, w.phonetic_uk, w.phonetic_us, w.part_of_speech,
            w.definition_cn, w.definition_en, levelToText(w.difficulty), w.frequency, w.categories].map(esc).join(','))
        }
        blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
        fileName = 'words-all.csv'
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error('Export failed:', err) }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">设置</h1>
      <p className="mb-6 text-muted-foreground">
        自定义应用的行为和外观
      </p>

      {/* 偏好设置（主题/语言/导出格式合并） */}
      <SectionCard
        icon={<Settings className="h-5 w-5 text-primary" />}
        title="偏好设置"
        className="mb-6"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">外观主题</label>
            <ChoiceRow value={theme} onChange={applyTheme} options={[
              { value: 'light', label: '浅色', icon: Sun },
              { value: 'dark', label: '深色', icon: Moon },
              { value: 'system', label: '跟随系统', icon: Monitor },
            ]} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">界面语言</label>
            <ChoiceRow value={language} onChange={(v) => { setLanguage(v); window.api.setSetting('language', v) }} options={[
              { value: 'zh', label: '中文' },
              { value: 'en', label: 'English' },
            ]} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">分类行为</label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={autoClassify}
                onChange={e => { setAutoClassify(e.target.checked); window.api.setSetting('auto_classify', String(e.target.checked)) }}
                className="h-4 w-4 rounded" />
              <div>
                <p className="font-medium">导入后自动分类</p>
                <p className="text-muted-foreground">
                  导入单词后自动运行语义分类（推荐开启）
                </p>
              </div>
            </label>
          </div>
        </div>
      </SectionCard>

      {/* 导出（格式 + 筛选 + 按钮合并） */}
      <SectionCard
        icon={<FileDown className="h-5 w-5 text-primary" />}
        title="导出单词表"
        className="mb-6"
        help={{
          title: '导出说明',
          children: (
            <>
              导出格式：CSV 可用 Excel/WPS 直接打开；JSON 适合程序处理或备份。<br />
              筛选：可按等级或词频只导出部分单词，默认导出全部。<br />
              「其他」= 没有等级标签的单词；「无数据」= 没有词频排名的单词。
            </>
          )
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">导出格式</label>
            <ChoiceRow value={exportFormat} onChange={(v) => { setExportFormat(v); window.api.setSetting('export_format', v) }} options={[
              { value: 'csv', label: 'CSV' },
              { value: 'xlsx', label: 'Excel' },
              { value: 'json', label: 'JSON' },
            ]} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">等级:</span>
              <select
                value={exportLevel}
                onChange={(e) => setExportLevel(e.target.value)}
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">全部等级</option>
                {LEVEL_DEFS.map(d => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
                <option value="other">其他</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">词频:</span>
              <select
                value={exportFreq}
                onChange={(e) => setExportFreq(e.target.value)}
                className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">全部词频</option>
                {FREQ_BANDS.map(b => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
                <option value="none">无数据</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            导出单词 ({exportFormat === 'json' ? 'JSON' : 'CSV'})
          </button>
        </div>
      </SectionCard>

      {/* AI 模型配置（默认折叠） */}
      <section className="mb-6 rounded-lg border border-border bg-card p-5">
        <button
          onClick={() => setAiOpen(o => !o)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">AI 模型配置</h2>
            <HelpTip title="AI 模型配置">
              使用大模型自动补全单词信息（音标、释义、例句）。<br />
              支持本地 Ollama（免费、数据不出电脑）和 DeepSeek API（云端）。
            </HelpTip>
          </div>
          {aiOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {aiOpen && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              使用大模型自动补全单词信息（音标、释义、例句）和智能分类。支持本地 Ollama 和 DeepSeek API。
            </p>

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

            {/* Test result */}
            {testResult && (
              <div className={`flex items-center gap-2 rounded-md p-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300'}`}>
                {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
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
          </div>
        )}
      </section>

      {/* Developer mode toggle */}
      <SectionCard
        icon={<Database className="h-5 w-5 text-primary" />}
        title="开发者模式"
        className="mb-6"
        help={{
          title: '开发者模式',
          children: (
            <>
              开启后侧边栏会出现「开发者」入口，里面可以：<br />
              · 查看数据总览和数据库位置<br />
              · 用「查词试验场」看词典和自动分类对任意单词的判断<br />
              · 维护你的小词典（大词典查不到的词，你手动补词条）<br />
              所有修改都会自动记日志、可撤销。
            </>
          )
        }}
      >
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={devEnabled}
            onChange={e => {
              setDevEnabled(e.target.checked)
              window.api.setSetting('dev_mode', String(e.target.checked))
            }}
            className="h-4 w-4 rounded" />
          <div>
            <p className="font-medium">启用开发者模式</p>
            <p className="text-muted-foreground">
              开启后侧边栏出现「开发者」入口；所有修改记录日志，可撤销
            </p>
          </div>
        </label>
      </SectionCard>

      {/* Data management */}
      <section className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-800 dark:bg-red-900/40">
        <div className="mb-4 flex items-center gap-3">
          <Database className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h2 className="font-semibold text-red-900 dark:text-red-300">数据管理</h2>
          <HelpTip title="数据管理">
            「清空所有单词」会删除全部单词及其分类、例句，不可恢复。<br />
            「重置为默认分类」恢复出厂 81 个分类并清空所有单词的分类关联，下次自动分类会重新关联。
          </HelpTip>
        </div>
        <p className="mb-3 text-sm text-red-700 dark:text-red-400">
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
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/60 dark:text-red-300 dark:hover:bg-red-900/80"
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
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/60 dark:text-red-300 dark:hover:bg-red-900/80"
          >
            重置为默认分类
          </button>
        </div>
      </section>
    </div>
  )
}
