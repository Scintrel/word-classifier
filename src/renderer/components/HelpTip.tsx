/**
 * HelpTip - 圆圈问号帮助提示。
 *
 * 点击问号按钮弹出说明卡片，点卡片以外的任意位置关闭。
 * 用于给不熟悉术语的用户解释功能（音标、词性、置信度……）。
 *
 * 定位规则：默认弹窗右缘对齐按钮（向左展开）；
 * 当按钮离内容区左缘太近时改为左缘对齐按钮（向右展开），
 * 避免弹窗被左侧边栏/滚动容器裁掉。
 */
import { useRef, useState, useEffect, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'

/** 弹窗宽度 18rem(288px) + 按钮宽度 + 侧边栏(224px) + 余量 */
const FLIP_THRESHOLD = 520

interface HelpTipProps {
  /** 弹窗标题 */
  title?: string
  children: ReactNode
}

export default function HelpTip({ title = '帮助', children }: HelpTipProps) {
  const [open, setOpen] = useState(false)
  const [alignLeft, setAlignLeft] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && ref.current) {
      // 按钮离左缘太近 → 弹窗向右展开（left-0）；否则保持向右对齐（right-0）
      const rect = ref.current.getBoundingClientRect()
      setAlignLeft(rect.left < FLIP_THRESHOLD)
    }
  }

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={title}
        title={title}
        className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <div className={`absolute top-7 z-50 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-lg ${alignLeft ? 'left-0' : 'right-0'}`}>
          <p className="mb-1 font-semibold text-foreground">{title}</p>
          {children}
        </div>
      )}
    </div>
  )
}
