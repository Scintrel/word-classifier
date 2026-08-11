import { useState, useEffect } from 'react'
import { X, Save, Trash2, Plus, Loader2 } from 'lucide-react'

interface WordData {
  id: number
  word: string
  phonetic_uk?: string
  phonetic_us?: string
  part_of_speech?: string
  definition_cn?: string
  definition_en?: string
  difficulty?: string
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

const DIFFICULTY_OPTIONS = [
  { value: 'beginner', label: '初级', color: 'bg-green-100 text-green-700' },
  { value: 'intermediate', label: '中级', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'advanced', label: '高级', color: 'bg-red-100 text-red-700' },
  { value: 'unknown', label: '未知', color: 'bg-gray-100 text-gray-500' },
]

const POS_OPTIONS = [
  'noun', 'verb', 'adjective', 'adverb', 'preposition',
  'conjunction', 'pronoun', 'interjection', 'article'
]

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
        difficulty: word.difficulty ?? 'unknown'
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

  /** Toggle a category assignment */
  function toggleCategory(cat: Category) {
    const isAssigned = wordCategories.some(c => c.id === cat.id)
    if (isAssigned) {
      setWordCategories(prev => prev.filter(c => c.id !== cat.id))
    } else {
      setWordCategories(prev => [...prev, cat])
    }
  }

  // Only show root categories and their children for simplicity
  const rootCategories = allCategories.filter(c => c.parent_id === null)

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

      {/* Side panel */}
      <div className="fixed inset-y-0 right-0 z-40 flex w-[420px] flex-col border-l border-border bg-card shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">编辑单词</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 space-y-5 p-5">
          {/* Word */}
          <div>
            <label className="mb-1 block text-sm font-medium">单词 *</label>
            <input
              type="text"
              value={word.word}
              onChange={(e) => updateField('word', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Phonetics */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">英式音标</label>
              <input
                type="text"
                value={word.phonetic_uk ?? ''}
                onChange={(e) => updateField('phonetic_uk', e.target.value)}
                placeholder="/ˈɪŋɡlɪʃ/"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">美式音标</label>
              <input
                type="text"
                value={word.phonetic_us ?? ''}
                onChange={(e) => updateField('phonetic_us', e.target.value)}
                placeholder="/ˈɪŋɡlɪʃ/"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Part of speech + Difficulty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">词性</label>
              <select
                value={word.part_of_speech ?? ''}
                onChange={(e) => updateField('part_of_speech', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">-- 未知 --</option>
                {POS_OPTIONS.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">难度</label>
              <select
                value={word.difficulty ?? 'unknown'}
                onChange={(e) => updateField('difficulty', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {DIFFICULTY_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Definitions */}
          <div>
            <label className="mb-1 block text-sm font-medium">中文释义</label>
            <textarea
              value={word.definition_cn ?? ''}
              onChange={(e) => updateField('definition_cn', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">英文释义</label>
            <textarea
              value={word.definition_en ?? ''}
              onChange={(e) => updateField('definition_en', e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Categories */}
          <div>
            <label className="mb-2 block text-sm font-medium">所属分类</label>
            <div className="flex flex-wrap gap-2">
              {rootCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    wordCategories.some(c => c.id === cat.id)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                  style={wordCategories.some(c => c.id === cat.id) ? {
                    backgroundColor: cat.color,
                    borderColor: cat.color
                  } : {}}
                >
                  {cat.name_cn || cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Examples */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              例句 ({examples.length})
            </label>
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

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
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
