/**
 * PageHeader - 统一的页面标题行。
 * 标题 + 副标题 + 可选的帮助提示 + 右侧操作按钮区。
 * 所有页面都用它，保证观感一致。
 */
import type { ReactNode } from 'react'
import HelpTip from './HelpTip'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** 帮助说明（提供后标题旁出现圆圈问号） */
  help?: { title: string; children: ReactNode }
  /** 右侧操作区（按钮等） */
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, help, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{title}</h1>
          {help && (
            <HelpTip title={help.title}>{help.children}</HelpTip>
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
