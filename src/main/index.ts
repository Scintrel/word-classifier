import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './database/connection'
import { runMigrations } from './database/migrations'
import { registerIpcHandlers } from './ipc/handlers'

// 主窗口引用（保持全局引用，防止被垃圾回收导致窗口消失）
let mainWindow: BrowserWindow | null = null

/**
 * 创建应用主窗口。
 * webPreferences 的三个安全开关缺一不可：
 * - contextIsolation: true  —— 把界面和后台隔离，界面脚本无法直接碰 Node/系统能力
 * - nodeIntegration: false   —— 界面上禁用 Node.js 能力，即使界面被攻击也拿不到系统权限
 * - sandbox: true            —— 再多一层沙箱保险，界面脚本跑在受限环境里
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '单词分类app',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  })

  // 窗口内容准备好后再显示，避免白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 拦截新窗口打开：只放行 http/https 链接在系统浏览器打开，其余协议一律拒绝
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 开发模式加载 dev 服务器（支持热更新），生产模式加载打包好的页面
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 应用启动流程：初始化数据库 → 建表/升级 → 注册界面通信通道 → 开窗口
app.whenReady().then(async () => {
  const db = await initDatabase()
  runMigrations(db)
  registerIpcHandlers()
  createWindow()

  // Mac 上点 Dock 图标时如果没窗口就重新创建
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 退出前把内存数据库写回磁盘（closeDatabase 内部会先保存再关闭）
app.on('before-quit', () => {
  closeDatabase()
})

// 所有窗口关闭后退出应用（Mac 除外——Mac 习惯是关窗不退出）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
