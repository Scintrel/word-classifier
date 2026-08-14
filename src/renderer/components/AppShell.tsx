import { type ReactNode, useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Sun, Moon, Loader2 } from 'lucide-react'
import Sidebar from './Sidebar'
import { useTaskStore, TASK_LABELS, runningTask } from '../stores/taskStore'

interface AppShellProps { children: ReactNode }

export default function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  // 批量任务全局状态：顶部栏显示运行中的任务（切页不中断）
  const tasks = useTaskStore(s => s.tasks)
  const running = runningTask(tasks)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('app-theme')
    if (stored === 'dark') {
      document.documentElement.classList.add('dark'); setIsDark(true)
    } else if (stored === 'light') {
      document.documentElement.classList.remove('dark'); setIsDark(false)
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      document.documentElement.classList.toggle('dark', mq.matches)
      setIsDark(mq.matches)
    }
  }, [])

  // 切页时内容区滚回顶部（页面组件常驻不销毁，但滚动位置不应沿用上一页）
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  // 操作记录：每次页面切换自动上报（出问题时 Claude 可还原操作过程）
  useEffect(() => {
    window.api.devLogUserAction({
      page: location.pathname,
      action: '切换页面',
      detail: titles[location.pathname] || location.pathname
    }).catch(() => { /* 记录失败不影响使用 */ })
  }, [location.pathname])

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('app-theme', next ? 'dark' : 'light')
  }

  const showBack = location.pathname !== '/import'
  const titles: Record<string, string> = {
    '/import': '导入单词', '/words': '单词列表', '/categories': '分类浏览',
    '/search': '搜索', '/editor': '单词检修', '/settings': '设置', '/dev': '开发者模式'
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-6 py-2">
          <div className="flex items-center gap-3">
            {showBack && (
              <button onClick={() => navigate(-1)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" />返回
              </button>
            )}
            <span className="text-sm font-medium text-muted-foreground">{titles[location.pathname] || ''}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 批量任务运行指示器：任何页面都能看到，点击回到检修页 */}
            {running && (
              <button
                onClick={() => navigate('/editor')}
                title="点击回到「单词检修」查看详情"
                className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                {TASK_LABELS[running.type]}中
                {running.state.total > 0 && ` ${running.state.current}/${running.state.total}`}
              </button>
            )}
            <button onClick={toggleDark}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title={isDark ? '切换浅色' : '切换深色'}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  )
}
