/**
 * 等级 / 词频 / 词性的共享常量——界面上所有用到这些概念的地方
 * （筛选栏、单词列表、编辑面板、搜索、导出）都从这里取值，
 * 保证显示一致。
 */

// ============================================
// 等级（考试标签，key 与 ECDICT 词典的 tag 一致）
// ============================================

export interface LevelDef {
  key: string
  label: string
  /** 徽章样式（含深色模式 dark: 变体） */
  badge: string
}

export const LEVEL_DEFS: LevelDef[] = [
  { key: 'zk',    label: '初中', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  { key: 'gk',    label: '高中', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300' },
  { key: 'cet4',  label: 'CET4', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { key: 'cet6',  label: 'CET6', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' },
  { key: 'ky',    label: '考研', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' },
  { key: 'toefl', label: '托福', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  { key: 'ielts', label: '雅思', badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300' },
  { key: 'gre',   label: 'GRE',  badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
]

export const OTHER_LEVEL_BADGE = 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'

export const LEVEL_LABEL: Record<string, string> = Object.fromEntries(
  LEVEL_DEFS.map(d => [d.key, d.label])
)

/**
 * 把 difficulty 字段（逗号连接的标签）解析成标签数组。
 * 'none'/'unknown'/空 都视为无标签（返回 []）。
 */
export function parseLevels(difficulty?: string | null): string[] {
  if (!difficulty || difficulty === 'none' || difficulty === 'unknown') return []
  return difficulty.split(',').map(s => s.trim()).filter(s => s in LEVEL_LABEL)
}

// ============================================
// 词频（COCA 排名分 5 档，数字越小越常用）
// ⚠️ 档位数值与 src/main/ipc/handlers.ts 的 FREQ_BAND_RANGES 保持一致
// ============================================

export interface FreqBandDef {
  key: string
  label: string
  badge: string
}

export const FREQ_BANDS: FreqBandDef[] = [
  { key: 'top',  label: '超高频', badge: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  { key: 'high', label: '高频',   badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  { key: 'mid',  label: '中频',   badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' },
  { key: 'low',  label: '低频',   badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  { key: 'rare', label: '超低频', badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
]

export const FREQ_BAND_LABEL: Record<string, string> = Object.fromEntries(
  FREQ_BANDS.map(b => [b.key, b.label])
)
export const FREQ_BADGE_CLASS: Record<string, string> = Object.fromEntries(
  FREQ_BANDS.map(b => [b.key, b.badge])
)
export const NO_FREQ_BADGE = 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'

/** 原始 COCA 排名 → 档位 key；null/0 表示无数据 */
export function freqBand(frq: number | null | undefined): string | null {
  if (frq == null || frq <= 0) return null
  if (frq <= 1000) return 'top'
  if (frq <= 3000) return 'high'
  if (frq <= 8000) return 'mid'
  if (frq <= 20000) return 'low'
  return 'rare'
}

// ============================================
// 词性（筛选下拉与编辑面板共用）
// ============================================

export const POS_OPTIONS = [
  'noun', 'verb', 'adjective', 'adverb', 'preposition',
  'conjunction', 'pronoun', 'interjection', 'article',
  'abbreviation', 'auxiliary', 'numeral', 'suffix', 'prefix'
]

/** 词性的中文名（用于界面显示） */
export const POS_LABELS: Record<string, string> = {
  'noun': '名词', 'verb': '动词', 'adjective': '形容词', 'adverb': '副词',
  'preposition': '介词', 'conjunction': '连词', 'pronoun': '代词', 'interjection': '感叹词',
  'article': '冠词', 'abbreviation': '缩写', 'auxiliary': '助动词',
  'numeral': '数词', 'suffix': '后缀', 'prefix': '前缀',
}
