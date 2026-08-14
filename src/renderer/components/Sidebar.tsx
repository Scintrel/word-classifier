import { NavLink } from 'react-router-dom'
import {
  Upload,
  BookOpen,
  FolderTree,
  Search,
  Wrench,
  Settings,
  Terminal,
  Sparkles
} from 'lucide-react'
import { useDevStore } from '../stores/devStore'

/**
 * Navigation items for the sidebar.
 * Each item has a label (Chinese), icon, and route path.
 */
const navItems = [
  { to: '/import',      label: '导入单词', icon: Upload },
  { to: '/editor',      label: '单词检修', icon: Wrench },
  { to: '/words',       label: '单词列表', icon: BookOpen },
  { to: '/categories',  label: '分类浏览', icon: FolderTree },
  { to: '/search',      label: '搜索',     icon: Search },
  { to: '/settings',    label: '设置',     icon: Settings },
]

/**
 * Left sidebar with navigation links.
 * Highlights the current active page.
 * 开发者模式开启时，在「设置」上方显示「开发者」入口。
 */
export default function Sidebar() {
  const devEnabled = useDevStore(s => s.enabled)

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card">
      {/* App logo / title */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">单词分类app</span>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}

        {/* 开发者模式入口（设置页开关控制） */}
        {devEnabled && (
          <NavLink
            to="/dev"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`
            }
          >
            <Terminal className="h-4 w-4" />
            开发者
          </NavLink>
        )}
      </nav>

      {/* Footer: version info */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          单词分类app v1.0.0
        </p>
      </div>
    </aside>
  )
}
