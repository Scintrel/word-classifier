import { type ReactNode, useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Sun, Moon } from 'lucide-react'
import Sidebar from './Sidebar'

interface AppShellProps { children: ReactNode }

export default function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

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
      <main className="flex-1 overflow-y-auto">
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
          <button onClick={toggleDark}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={isDark ? '切换浅色' : '切换深色'}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  )
}
