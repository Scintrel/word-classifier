/**
 * EmptyState - 统一的空状态占位。
 * 图标 + 标题 + 说明 + 可选操作按钮，用于"还没有数据"等场景。
 */
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: ReactNode
  /** 可选的操作按钮（放在说明下方） */
  action?: ReactNode
  /** 高度等级：md（默认）或 sm */
  size?: 'sm' | 'md'
}

export default function EmptyState({ icon, title, description, action, size = 'md' }: EmptyStateProps) {
  const pad = size === 'sm' ? 'py-10' : 'py-16'
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-border ${pad} px-6`}>
      <div className="mb-3 text-muted-foreground/40">{icon}</div>
      <p className="font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground/70 text-center max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
