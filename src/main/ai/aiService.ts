/**
 * AI Service — supports both Ollama (local) and DeepSeek API (cloud).
 *
 * Usage:
 *   const ai = createAIService({ provider: 'deepseek', apiKey: 'sk-...', model: 'deepseek-chat' })
 *   const result = await ai.completeWord('abandon')
 *   // { phonetic: "ə'bændən", definition: '丢弃；放弃', examples: [...], pos: 'verb' }
 */

export interface AIConfig {
  provider: 'ollama' | 'deepseek'
  // Ollama
  ollamaUrl?: string
  // DeepSeek
  apiKey?: string
  model?: string
}

export interface WordCompletion {
  word: string
  phoneticUk: string
  phoneticUs: string
  definitionCn: string
  definitionEn: string
  partOfSpeech: string
  examples: { en: string; cn: string }[]
  difficulty: string
}

export interface ClassificationSuggestion {
  categoryId: number | null
  categoryName: string
  confidence: number
  reason: string
}

// ============================================
// Prompt templates
// ============================================

function buildCompleteWordPrompt(word: string): string {
  return `你是一个英语词典专家。请为以下英语单词提供完整信息。

单词: "${word}"

请严格按以下 JSON 格式返回（不要包含其他内容）:
{
  "word": "${word}",
  "phoneticUk": "英式音标(IPA格式，如 /ˈæpəl/)",
  "phoneticUs": "美式音标(IPA格式，如 /ˈæpəl/)",
  "definitionCn": "中文释义（简洁准确，多个义项用分号分隔）",
  "definitionEn": "English definition (concise)",
  "partOfSpeech": "词性(noun/verb/adjective/adverb/preposition/conjunction/pronoun/interjection/article)",
  "examples": [
    { "en": "英文例句1", "cn": "中文翻译1" },
    { "en": "英文例句2", "cn": "中文翻译2" }
  ],
  "difficulty": "难度(beginner/intermediate/advanced)"
}

注意:
- 音标必须是标准IPA格式
- 中文释义简洁准确
- 提供2个常用例句
- 只返回JSON，不要有其他文字`
}

function buildClassifyWordPrompt(word: string, definition: string): string {
  const categories = [
    '1-日常生活', '2-学习教育', '3-工作职场', '4-自然世界',
    '5-情感心理', '6-健康医疗', '7-文化艺术', '8-科技数码',
    '9-旅行交通', '10-社会人文', '11-未分类'
  ]
  return `你是一个词汇分类专家。请根据单词的含义将其归类到最合适的类别中。

单词: "${word}"
释义: "${definition || '无'}"

可选类别:
${categories.map(c => `  - ${c}`).join('\n')}

请严格按以下JSON格式返回（只返回JSON）:
{
  "categoryId": 数字(1-11),
  "categoryName": "类别名称",
  "confidence": 0.0到1.0之间的数字,
  "reason": "简短分类理由(中文，10字以内)"
}`
}

// ============================================
// AI Service
// ============================================

export function createAIService(config: AIConfig) {
  const { provider, ollamaUrl = 'http://localhost:11434', model } = config

  async function callAPI(prompt: string): Promise<string> {
    if (provider === 'ollama') {
      const url = `${ollamaUrl}/api/generate`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || 'qwen2.5:7b',
          prompt,
          stream: false
        })
      })
      if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`)
      const data = await res.json() as { response: string }
      return data.response
    } else {
      // DeepSeek API
      const apiKey = config.apiKey
      if (!apiKey) throw new Error('DeepSeek API 密钥未设置，请在设置页面配置')
      const url = 'https://api.deepseek.com/chat/completions'
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是一个专业的英语词典和词汇分类专家。请始终只返回要求的JSON格式，不要添加额外说明。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`DeepSeek API 错误 (${res.status}): ${errText}`)
      }
      const data = await res.json() as { choices: { message: { content: string } }[] }
      return data.choices[0]?.message?.content || ''
    }
  }

  function extractJSON(text: string): string {
    // Try to find JSON block
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? jsonMatch[0] : text
  }

  async function completeWord(word: string): Promise<WordCompletion | null> {
    try {
      const prompt = buildCompleteWordPrompt(word)
      const response = await callAPI(prompt)
      const json = extractJSON(response)
      const parsed = JSON.parse(json)

      return {
        word: parsed.word || word,
        phoneticUk: parsed.phoneticUk || '',
        phoneticUs: parsed.phoneticUs || '',
        definitionCn: parsed.definitionCn || '',
        definitionEn: parsed.definitionEn || '',
        partOfSpeech: parsed.partOfSpeech || '',
        examples: Array.isArray(parsed.examples) ? parsed.examples : [],
        difficulty: parsed.difficulty || 'unknown'
      }
    } catch (err) {
      console.error(`AI completeWord failed for "${word}":`, err)
      return null
    }
  }

  async function classifyWord(word: string, definition: string): Promise<ClassificationSuggestion | null> {
    try {
      const prompt = buildClassifyWordPrompt(word, definition)
      const response = await callAPI(prompt)
      const json = extractJSON(response)
      const parsed = JSON.parse(json)

      return {
        categoryId: typeof parsed.categoryId === 'number' ? parsed.categoryId : null,
        categoryName: parsed.categoryName || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reason: parsed.reason || ''
      }
    } catch (err) {
      console.error(`AI classifyWord failed for "${word}":`, err)
      return null
    }
  }

  /** Batch complete: process multiple words in one API call */
  async function completeWordsBatch(words: string[]): Promise<WordCompletion[]> {
    if (words.length === 0) return []

    const batchPrompt = `你是一个英语词典专家。请为以下英语单词列表提供完整信息。

单词列表: ${JSON.stringify(words)}

请严格按以下JSON数组格式返回（每个单词一个对象，不要包含其他内容）:
[
  {
    "word": "单词",
    "phoneticUk": "/.../",
    "phoneticUs": "/.../",
    "definitionCn": "中文释义",
    "definitionEn": "English definition",
    "partOfSpeech": "noun/verb/adjective等",
    "examples": [{ "en": "...", "cn": "..." }],
    "difficulty": "beginner/intermediate/advanced"
  },
  ...
]

注意:
- 每个单词提供2个例句
- 只返回JSON数组，不要有其他文字
- 如果某个单词不确定，也请尽力给出合理的结果`

    try {
      const response = await callAPI(batchPrompt)
      const json = extractJSON(response)
      const parsed = JSON.parse(json)

      if (!Array.isArray(parsed)) return []

      return parsed.map((item: Record<string, unknown>) => ({
        word: (item.word as string) || '',
        phoneticUk: (item.phoneticUk as string) || '',
        phoneticUs: (item.phoneticUs as string) || '',
        definitionCn: (item.definitionCn as string) || '',
        definitionEn: (item.definitionEn as string) || '',
        partOfSpeech: (item.partOfSpeech as string) || '',
        examples: Array.isArray(item.examples) ? item.examples as { en: string; cn: string }[] : [],
        difficulty: (item.difficulty as string) || 'unknown'
      }))
    } catch (err) {
      console.error('AI batch complete failed:', err)
      // Fall back to individual completions
      const results: WordCompletion[] = []
      for (const word of words) {
        const result = await completeWord(word)
        if (result) results.push(result)
      }
      return results
    }
  }

  /** Test connection */
  async function testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      if (provider === 'ollama') {
        const res = await fetch(`${ollamaUrl}/api/tags`)
        if (!res.ok) return { ok: false, message: `Ollama 连接失败: ${res.status}` }
        const data = await res.json() as { models?: { name: string }[] }
        const modelList = data.models?.map(m => m.name).join(', ') || '未知'
        return { ok: true, message: `Ollama 连接成功！可用模型: ${modelList}` }
      } else {
        if (!config.apiKey) return { ok: false, message: '请先设置 DeepSeek API 密钥' }
        const res = await fetch('https://api.deepseek.com/v1/models', {
          headers: { 'Authorization': `Bearer ${config.apiKey}` }
        })
        if (!res.ok) return { ok: false, message: `DeepSeek 连接失败: ${res.status}` }
        return { ok: true, message: 'DeepSeek API 连接成功！' }
      }
    } catch (err) {
      return { ok: false, message: `连接失败: ${err instanceof Error ? err.message : '未知错误'}` }
    }
  }

  return { completeWord, classifyWord, completeWordsBatch, testConnection }
}
