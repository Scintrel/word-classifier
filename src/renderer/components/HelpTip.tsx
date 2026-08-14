/**
 * HelpTip - 圆圈问号帮助提示。
 *
 * 点击问号按钮弹出说明卡片，点卡片以外的任意位置关闭。
 * 用于给不熟悉术语的用户解释功能（音标、词性、置信度……）。
 */
import { useRef, useState, useEffect, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'

interface HelpTipProps {
  /** 弹窗标题 */
  title?: string
  children: ReactNode
}

export default function HelpTip({ title = '帮助', children }: HelpTipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={title}
        title={title}
        className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-72 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-lg">
          <p className="mb-1 font-semibold text-foreground">{title}</p>
          {children}
        </div>
      )}
    </div>
  )
}
