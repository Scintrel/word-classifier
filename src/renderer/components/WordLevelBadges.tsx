/**
 * 等级徽章与词频徽章。
 * - LevelBadges：显示一个词的考试等级；maxLevels 限制显示数量（超出显示 +n）
 * - FreqBadge：显示词频档（超高频/高频/...），无数据显示"无数据"
 */
import {
  LEVEL_DEFS, LEVEL_LABEL, OTHER_LEVEL_BADGE,
  FREQ_BADGE_CLASS, FREQ_BAND_LABEL, NO_FREQ_BADGE,
  parseLevels, freqBand
} from '../constants/wordMeta'

/** 统一徽章规格：小、紧凑、不换行，保证表格行高稳定 */
export const BADGE_CLASS = 'inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-medium leading-5 whitespace-nowrap'

interface LevelBadgesProps {
  difficulty?: string | null
  /** 最多显示几个等级徽章（默认全部），超出部分显示灰色 +n */
  maxLevels?: number
}

export function LevelBadges({ difficulty, maxLevels }: LevelBadgesProps) {
  const levels = parseLevels(difficulty)
  if (levels.length === 0) {
    return (
      <span className={`${BADGE_CLASS} ${OTHER_LEVEL_BADGE}`}>
        其他
      </span>
    )
  }
  const shown = maxLevels ? levels.slice(0, maxLevels) : levels
  const hidden = maxLevels ? levels.length - shown.length : 0
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(k => (
        <span
          key={k}
          className={`${BADGE_CLASS} ${LEVEL_DEFS.find(d => d.key === k)?.badge ?? OTHER_LEVEL_BADGE}`}
        >
          {LEVEL_LABEL[k] ?? k}
        </span>
      ))}
      {hidden > 0 && (
        <span className={`${BADGE_CLASS} ${OTHER_LEVEL_BADGE}`} title={`还有 ${hidden} 个等级：${levels.slice(maxLevels).map(k => LEVEL_LABEL[k] ?? k).join('、')}`}>
          +{hidden}
        </span>
      )}
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
      <span className={`${BADGE_CLASS} ${NO_FREQ_BADGE}`}>
        无数据
      </span>
    )
  }
  return (
    <span className={`${BADGE_CLASS} ${FREQ_BADGE_CLASS[band]}`}>
      {FREQ_BAND_LABEL[band]}{showRank && frequency != null ? ` · 排名 ${frequency}` : ''}
    </span>
  )
}
