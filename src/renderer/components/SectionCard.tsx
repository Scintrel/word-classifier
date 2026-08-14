/**
 * SectionCard - 统一的分区卡片。
 * 图标 + 标题 + 可选的帮助提示 + 内容区。用于设置页、检修工具区等。
 */
import type { ReactNode } from 'react'
import HelpTip from './HelpTip'

interface SectionCardProps {
  icon?: ReactNode
  title: string
  help?: { title: string; children: ReactNode }
  /** 标题图标/文字的颜色（默认主题色） */
  titleClassName?: string
  children: ReactNode
  className?: string
}

export default function SectionCard({
  icon, title, help, titleClassName = 'text-primary', children, className = ''
}: SectionCardProps) {
  return (
    <section className={`rounded-lg border border-border bg-card p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-semibold">{title}</h2>
        {help && <HelpTip title={help.title}>{help.children}</HelpTip>}
      </div>
      {children}
    </section>
  )
}
