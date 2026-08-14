import { useState, useEffect } from 'react'
import { X, Save, Trash2, Plus, Loader2 } from 'lucide-react'
import { FreqBadge } from './WordLevelBadges'
import {
  POS_OPTIONS, LEVEL_DEFS, parseLevels
} from '../constants/wordMeta'

/** 面板内的小节标题（分隔线 + 小号标题） */
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-2 border-b border-border/60 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  )
}

interface WordData {
  id: number
  word: string
  phonetic_uk?: string
  phonetic_us?: string
  part_of_speech?: string
  definition_cn?: string
  definition_en?: string
  difficulty?: string
  frequency?: number | null
  created_at?: string
  updated_at?: string
}

interface Example {
  id: number
  word_id: number
  sentence_en: string
  sentence_cn?: string
}

interface Category {
  id: number
  name: string
  name_cn: string
  parent_id: number | null
  color: string
}

interface WordDetailPanelProps {
  wordId: number | null
  onClose: () => void
  onSaved: () => void  // Refresh the word list
}

/**
 * WordDetailPanel - slide-out panel for editing a word.
 * Shows all fields, example sentences, and category assignments.
 */
export default function WordDetailPanel({ wordId, onClose, onSaved }: WordDetailPanelProps) {
  const [word, setWord] = useState<WordData | null>(null)
  const [examples, setExamples] = useState<Example[]>([])
  const [wordCategories, setWordCategories] = useState<Category[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newExampleEn, setNewExampleEn] = useState('')
  const [newExampleCn, setNewExampleCn] = useState('')
  // 分类选择区是否展开（默认折叠，只显示已选分类）
  const [showCatPicker, setShowCatPicker] = useState(false)

  // Load word data when wordId changes
  useEffect(() => {
    if (!wordId) return
    loadWord(wordId)
    loadAllCategories()
  }, [wordId])

  async function loadWord(id: number) {
    setLoading(true)
    try {
      const data = await window.api.getWord(id) as {
        word: WordData
        examples: Example[]
        categories: Category[]
      } | null
      if (data) {
        setWord(data.word)
        setExamples(data.examples)
        setWordCategories(data.categories)
      }
    } catch (err) {
      console.error('Failed to load word:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadAllCategories() {
    try {
      const cats = await window.api.getCategories() as Category[]
      setAllCategories(cats)
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  /** Update a single field of the word (optimistic UI update) */
  function updateField(field: string, value: string) {
    if (!word) return
    setWord({ ...word, [field]: value })
  }

  /** Save all changes */
  async function handleSave() {
    if (!word) return
    setSaving(true)
    try {
      await window.api.updateWord(word.id, {
        word: word.word,
        phonetic_uk: word.phonetic_uk ?? null,
        phonetic_us: word.phonetic_us ?? null,
        part_of_speech: word.part_of_speech ?? null,
        definition_cn: word.definition_cn ?? null,
        definition_en: word.definition_en ?? null,
        difficulty: word.difficulty ?? ''
      })

      // Save category changes
      await window.api.setWordCategories(
        word.id,
        wordCategories.map(c => c.id)
      )

      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save word:', err)
    } finally {
      setSaving(false)
    }
  }

  /** Delete this word */
  async function handleDelete() {
    if (!word) return
    if (!confirm(`确定要删除单词 "${word.word}" 吗？此操作不可撤销。`)) return
    try {
      await window.api.deleteWord(word.id)
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to delete word:', err)
    }
  }

  /** Add a new example sentence */
  async function handleAddExample() {
    if (!word || !newExampleEn.trim()) return
    try {
      await window.api.addExample(word.id, newExampleEn.trim(), newExampleCn.trim() || undefined)
      setNewExampleEn('')
      setNewExampleCn('')
      // Reload to get the new example with its ID
      await loadWord(word.id)
    } catch (err) {
      console.error('Failed to add example:', err)
    }
  }

  /** Delete an example */
  async function handleDeleteExample(exampleId: number) {
    try {
      await window.api.deleteExample(exampleId)
      setExamples(prev => prev.filter(e => e.id !== exampleId))
    } catch (err) {
      console.error('Failed to delete example:', err)
    }
  }

  /** Toggle a category assignment（子类与父类联动） */
  function toggleCategory(cat: Category) {
    const isAssigned = wordCategories.some(c => c.id === cat.id)
    if (isAssigned) {
      // 取消父类时连带取消其所有子类
      setWordCategories(prev => prev.filter(c => c.id !== cat.id && c.parent_id !== cat.id))
    } else {
      const next = [...wordCategories, cat]
      // 选中子类时自动带上它的父类
      if (cat.parent_id !== null) {
        const parent = allCategories.find(c => c.id === cat.parent_id)
        if (parent && !next.some(c => c.id === parent.id)) {
          next.push(parent)
        }
      }
      setWordCategories(next)
    }
  }

  /** 切换词性（一词可多词性，逗号连接存储） */
  function togglePos(pos: string) {
    if (!word) return
    const current = (word.part_of_speech ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const next = current.includes(pos)
      ? current.filter(p => p !== pos)
      : [...current, pos]
    updateField('part_of_speech', next.join(','))
  }

  /** 切换考试等级（一词可多等级，逗号连接存储；全部取消 = 无标签） */
  function toggleLevel(key: string) {
    if (!word) return
    const current = parseLevels(word.difficulty)
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key]
    updateField('difficulty', next.join(','))
  }

  // 当前选中的词性列表
  const wordPosList = (word?.part_of_speech ?? '').split(',').map(s => s.trim()).filter(Boolean)

  // 当前选中的等级列表
  const currentLevels = parseLevels(word?.difficulty)

  // 根类（含其子类分组展示）
  const rootCategories = allCategories.filter(c => c.parent_id === null)
  const childrenOf = (parentId: number) => allCategories.filter(c => c.parent_id === parentId)

  if (!wordId) return null

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 z-40 flex w-96 items-center justify-center border-l border-border bg-card shadow-xl">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!word) {
    return (
      <div className="fixed inset-y-0 right-0 z-40 flex w-96 items-center justify-center border-l border-border bg-card shadow-xl">
        <p className="text-muted-foreground">加载失败</p>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />

      {/* Side panel（头部固定、中间滚动、底部按钮固定） */}
      <div className="fixed inset-y-0 right-0 z-40 flex w-[420px] flex-col border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">编辑单词</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form body（滚动区） */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* 基本信息 */}
          <div>
            <SectionLabel>基本信息</SectionLabel>
            <label className="mb-1 block text-sm font-medium">单词 *</label>
            <input
              type="text"
              value={word.word}
              onChange={(e) => updateField('word', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Phonetics */}
          <div>
            <SectionLabel>音标</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">英式</label>
                <input
                  type="text"
                  value={word.phonetic_uk ?? ''}
                  onChange={(e) => updateField('phonetic_uk', e.target.value)}
                  placeholder="/ˈɪŋɡlɪʃ/"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">美式</label>
                <input
                  type="text"
                  value={word.phonetic_us ?? ''}
                  onChange={(e) => updateField('phonetic_us', e.target.value)}
                  placeholder="/ˈɪŋɡlɪʃ/"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* 词性（英文全称多选标签） */}
          <div>
            <SectionLabel>词性（可多选）</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {POS_OPTIONS.map(pos => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => togglePos(pos)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    wordPosList.includes(pos)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {/* 等级 + 词频 */}
          <div>
            <SectionLabel>等级与词频</SectionLabel>
            <label className="mb-1 block text-sm font-medium">等级（可多选，不选表示「其他」）</label>
            <div className="flex flex-wrap gap-1.5">
              {LEVEL_DEFS.map(d => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleLevel(d.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    currentLevels.includes(d.key)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              一个单词可同时属于多个考试等级（如 高中+CET4）。等级由内置词典自动生成。
            </p>
            <div className="mt-3">
              <label className="mb-1 block text-sm font-medium">词频（自动生成，不可修改）</label>
              <div className="flex items-center gap-2">
                <FreqBadge frequency={word.frequency} showRank />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                按 COCA 语料库排名分档，排名越靠前越常用。可到「单词检修」页用「等级词频回填」刷新。
              </p>
            </div>
          </div>

          {/* Definitions */}
          <div>
            <SectionLabel>释义</SectionLabel>
            <label className="mb-1 block text-sm font-medium">中文释义</label>
            <textarea
              value={word.definition_cn ?? ''}
              onChange={(e) => updateField('definition_cn', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <label className="mb-1 mt-3 block text-sm font-medium">英文释义</label>
            <textarea
              value={word.definition_en ?? ''}
              onChange={(e) => updateField('definition_en', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Categories（折叠式：默认只显示已选分类） */}
          <div>
            <SectionLabel>所属分类</SectionLabel>
            {!showCatPicker ? (
              <div>
                <div className="flex flex-wrap gap-1.5">
                  {wordCategories.length === 0 ? (
                    <span className="text-sm text-muted-foreground">未分类</span>
                  ) : (
                    wordCategories.map(cat => (
                      <span
                        key={cat.id}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: cat.color || '#6b7280' }}
                      >
                        {cat.name_cn || cat.name}
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className="ml-0.5 rounded-full hover:bg-white/25"
                          title="移除"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatPicker(true)}
                  className="mt-2 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Plus className="mr-1 inline h-3.5 w-3.5" />
                  添加分类
                </button>
              </div>
            ) : (
              <div>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
                  {rootCategories.map((root) => (
                    <div key={root.id}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(root)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          wordCategories.some(c => c.id === root.id)
                            ? 'text-white'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                        style={wordCategories.some(c => c.id === root.id) ? {
                          backgroundColor: root.color,
                          borderColor: root.color
                        } : {}}
                      >
                        {root.name_cn || root.name}
                      </button>
                      {/* 子类（缩进显示） */}
                      {childrenOf(root.id).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5 pl-4">
                          {childrenOf(root.id).map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => toggleCategory(sub)}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                                wordCategories.some(c => c.id === sub.id)
                                  ? 'text-white'
                                  : 'bg-muted text-muted-foreground hover:bg-accent'
                              }`}
                              style={wordCategories.some(c => c.id === sub.id) ? {
                                backgroundColor: sub.color,
                                borderColor: sub.color
                              } : {}}
                            >
                              {sub.name_cn || sub.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatPicker(false)}
                  className="mt-2 w-full rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  完成
                </button>
              </div>
            )}
          </div>

          {/* Examples */}
          <div>
            <SectionLabel>例句 ({examples.length})</SectionLabel>
            <div className="space-y-2">
              {examples.map((ex) => (
                <div key={ex.id} className="flex items-start gap-2 rounded-md border border-border bg-background p-2.5 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{ex.sentence_en}</p>
                    {ex.sentence_cn && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{ex.sentence_cn}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteExample(ex.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {/* Add new example */}
              <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
                <input
                  type="text"
                  placeholder="输入英文例句..."
                  value={newExampleEn}
                  onChange={(e) => setNewExampleEn(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExample()}
                  className="w-full rounded border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="中文翻译（可选）"
                    value={newExampleCn}
                    onChange={(e) => setNewExampleCn(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddExample()}
                    className="flex-1 rounded border border-input bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={handleAddExample}
                    disabled={!newExampleEn.trim()}
                    className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions（固定在面板底部，不随内容滚动） */}
        <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-5 py-4">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            删除
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !word.word.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              保存
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
