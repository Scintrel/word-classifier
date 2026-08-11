import { useState, useEffect } from 'react'
import { ArrowRight, Check, AlertCircle } from 'lucide-react'
import type { ColumnMapping } from '../../preload/index'

interface ColumnMapperProps {
  /** Column headers found in the uploaded file */
  headers: string[]
  /** Called when the user confirms their column mapping */
  onConfirm: (mapping: ColumnMapping) => void
  /** Called when the user wants to go back */
  onBack: () => void
}

/**
 * Field definitions — what word fields we can map file columns to.
 * Each field has a key (database column), display label, and whether it's required.
 */
const FIELD_DEFINITIONS: {
  key: keyof ColumnMapping
  label: string
  required: boolean
  examples: string[]
}[] = [
  {
    key: 'word',
    label: '单词',
    required: true,
    examples: ['word', '单词', '词汇', 'vocabulary', 'spelling', '拼写']
  },
  {
    key: 'phoneticUk',
    label: '英式音标',
    required: false,
    examples: ['phonetic_uk', '英式音标', '音标(英)', 'IPA_UK', 'pronunciation']
  },
  {
    key: 'phoneticUs',
    label: '美式音标',
    required: false,
    examples: ['phonetic_us', '美式音标', '音标(美)', 'IPA_US']
  },
  {
    key: 'definitionCn',
    label: '中文释义',
    required: false,
    examples: ['definition_cn', '中文释义', '释义', '意思', 'meaning', '解释', 'definition']
  },
  {
    key: 'definitionEn',
    label: '英文释义',
    required: false,
    examples: ['definition_en', '英文释义', 'english definition']
  },
  {
    key: 'partOfSpeech',
    label: '词性',
    required: false,
    examples: ['part_of_speech', '词性', 'pos', '品词', 'type']
  },
  {
    key: 'exampleSentenceEn',
    label: '英文例句',
    required: false,
    examples: ['example_en', '例句', '英文例句', 'sentence', 'example']
  },
  {
    key: 'exampleSentenceCn',
    label: '例句翻译',
    required: false,
    examples: ['example_cn', '例句翻译', '中文例句', 'translation']
  },
  {
    key: 'difficulty',
    label: '难度等级',
    required: false,
    examples: ['difficulty', '难度', 'level', '等级', 'degree']
  }
]

/**
 * Auto-match file headers to word fields using fuzzy matching.
 * Returns a partial ColumnMapping with the best guesses.
 */
function autoMatch(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {}

  for (const field of FIELD_DEFINITIONS) {
    // Try exact match first (case-insensitive)
    const exact = headers.find(
      h => h.toLowerCase().trim() === field.key.toLowerCase()
    )
    if (exact) {
      ;(mapping as Record<string, string>)[field.key] = exact
      continue
    }

    // Try matching against example names
    const matched = headers.find(h =>
      field.examples.some(ex =>
        h.toLowerCase().trim().includes(ex.toLowerCase())
      )
    )
    if (matched) {
      ;(mapping as Record<string, string>)[field.key] = matched
      continue
    }
  }

  // If 'word' field still not matched, try the first column as fallback
  if (!mapping.word && headers.length > 0) {
    mapping.word = headers[0]
  }

  return mapping
}

/**
 * ColumnMapper - lets the user map file columns to word fields.
 *
 * Shows each target field with a dropdown listing all file column names.
 * Auto-detects the best match and pre-selects it.
 * Required fields are marked and validated before confirming.
 */
export default function ColumnMapper({ headers, onConfirm, onBack }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  // Auto-match columns on mount
  useEffect(() => {
    const auto = autoMatch(headers)
    const initial: Record<string, string> = {}
    for (const field of FIELD_DEFINITIONS) {
      initial[field.key] = (auto as Record<string, string>)[field.key] ?? ''
    }
    setMapping(initial)
  }, [headers])

  function handleFieldChange(fieldKey: string, columnName: string) {
    setMapping(prev => ({ ...prev, [fieldKey]: columnName }))
    setError(null)
  }

  function handleConfirm() {
    // Validate required fields
    if (!mapping.word) {
      setError('请选择「单词」对应的列（必须）')
      return
    }

    // Build the mapping, omitting empty optional fields
    const result: ColumnMapping = {
      word: mapping.word
    }

    for (const field of FIELD_DEFINITIONS) {
      if (field.key === 'word') continue
      if (mapping[field.key]) {
        ;(result as Record<string, string>)[field.key] = mapping[field.key]
      }
    }

    onConfirm(result)
  }

  const mappedCount = FIELD_DEFINITIONS.filter(f => mapping[f.key]).length
  const requiredFilled = !!mapping.word

  return (
    <div className="rounded-lg border border-border p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">列映射</h3>
          <p className="text-sm text-muted-foreground">
            告诉程序每个列对应什么内容。程序已自动匹配，你可以手动调整。
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          已映射 {mappedCount}/{FIELD_DEFINITIONS.length} 个字段
        </span>
      </div>

      {/* Field mapping rows */}
      <div className="space-y-3">
        {FIELD_DEFINITIONS.map((field) => (
          <div key={field.key} className="flex items-center gap-3">
            {/* Field label */}
            <div className="w-28 shrink-0">
              <span className="text-sm font-medium">
                {field.label}
                {field.required && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </span>
            </div>

            {/* Arrow */}
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />

            {/* Column selector dropdown */}
            <div className="relative flex-1">
              <select
                value={mapping[field.key] ?? ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                  mapping[field.key]
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-input'
                } ${field.required && !mapping[field.key] ? 'border-red-300' : ''}`}
              >
                <option value="">-- 不映射（跳过） --</option>
                {headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>

              {/* Auto-match indicator */}
              {mapping[field.key] && (
                <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          ← 返回
        </button>

        <button
          onClick={handleConfirm}
          disabled={!requiredFilled}
          className={`rounded-md px-6 py-2.5 text-sm font-medium transition-colors ${
            requiredFilled
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          确认映射，开始导入
        </button>
      </div>
    </div>
  )
}
