import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import AppShell from './components/AppShell'
import ImportView from './views/ImportView'
import WordListView from './views/WordListView'
import CategoryView from './views/CategoryView'
import SearchView from './views/SearchView'
import DataEditorView from './views/DataEditorView'
import SettingsView from './views/SettingsView'
import DevModeView from './views/DevModeView'

/**
 * 页面常驻模式：7 个页面全部挂载，切换时只做显示/隐藏（hidden 类），
 * 不销毁组件——筛选、翻页、搜索结果、展开/选中等状态跨页面保留。
 */
export default function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // 根路径默认进导入页
  useEffect(() => {
    if (pathname === '/') navigate('/import', { replace: true })
  }, [pathname, navigate])

  const show = (p: string) => pathname === p ? 'contents' : 'hidden'

  return (
    <AppShell>
      <div className={show('/import')}><ImportView active={pathname === '/import'} /></div>
      <div className={show('/editor')}><DataEditorView /></div>
      <div className={show('/words')}><WordListView active={pathname === '/words'} /></div>
      <div className={show('/categories')}><CategoryView active={pathname === '/categories'} /></div>
      <div className={show('/search')}><SearchView /></div>
      <div className={show('/settings')}><SettingsView /></div>
      <div className={show('/dev')}><DevModeView /></div>
    </AppShell>
  )
}
