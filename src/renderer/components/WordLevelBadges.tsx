/**
 * 等级徽章与词频徽章。
 * - LevelBadges：显示一个词的全部考试等级（初中/高中/CET4/...），无标签显示"其他"
 * - FreqBadge：显示词频档（超高频/高频/...），无数据显示"无数据"
 */
import {
  LEVEL_DEFS, LEVEL_LABEL, OTHER_LEVEL_BADGE,
  FREQ_BADGE_CLASS, FREQ_BAND_LABEL, NO_FREQ_BADGE,
  parseLevels, freqBand
} from '../constants/wordMeta'

interface LevelBadgesProps {
  difficulty?: string | null
}

export function LevelBadges({ difficulty }: LevelBadgesProps) {
  const levels = parseLevels(difficulty)
  if (levels.length === 0) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OTHER_LEVEL_BADGE}`}>
        其他
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {levels.map(k => (
        <span
          key={k}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_DEFS.find(d => d.key === k)?.badge ?? OTHER_LEVEL_BADGE}`}
        >
          {LEVEL_LABEL[k] ?? k}
        </span>
      ))}
    </div>
  )
}

interface FreqBadgeProps {
  frequency?: number | null
  /** 是否附带显示原始排名数字（编辑面板用） */
  showRank?: boolean
}

export function FreqBadge({ frequency, showRank = false }: FreqBadgeProps) {
  const band = freqBand(frequency)
  if (!band) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NO_FREQ_BADGE}`}>
        无数据
      </span>
    )
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FREQ_BADGE_CLASS[band]}`}>
      {FREQ_BAND_LABEL[band]}{showRank && frequency != null ? ` · 排名 ${frequency}` : ''}
    </span>
  )
}
