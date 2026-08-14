/**
 * CategoryBadges - 分类彩色徽章。
 *
 * 后端 words:list 返回的 category_badges 是拼接字符串：
 * "名称|颜色||名称|颜色"（每个徽章"名称|颜色"，徽章之间用 "||" 连接），
 * 这里解析后渲染成各自分类颜色的徽章。
 */

export function parseCategoryBadges(raw?: string | null): { name: string; color: string }[] {
  if (!raw) return []
  return raw.split('||').map(s => {
    const i = s.lastIndexOf('|')
    return i >= 0
      ? { name: s.slice(0, i).trim(), color: s.slice(i + 1).trim() }
      : { name: s.trim(), color: '' }
  }).filter(b => b.name)
}

interface CategoryBadgesProps {
  raw?: string | null
  /** 最多显示几个徽章，超出显示 +n */
  max?: number
}

export default function CategoryBadges({ raw, max = 3 }: CategoryBadgesProps) {
  const badges = parseCategoryBadges(raw)
  if (badges.length === 0) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        未分类
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {badges.slice(0, max).map((b, i) => (
        <span
          key={i}
          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: b.color || '#6b7280' }}
        >
          {b.name}
        </span>
      ))}
      {badges.length > max && (
        <span className="text-xs text-muted-foreground">+{badges.length - max}</span>
      )}
    </div>
  )
}
