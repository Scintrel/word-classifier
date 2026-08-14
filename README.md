# 单词分类app 📚

一个本地运行的桌面应用，帮你导入、管理、分类和导出英语单词表。

**所有数据都保存在你自己的电脑上，不会上传到互联网。**

---

## ✨ 主要功能

| 功能 | 说明 |
|------|------|
| 📥 **文件导入** | 支持 CSV、Excel（.xlsx/.xls）、TXT、JSON、PDF 格式，拖入文件即可导入 |
| 🔍 **智能解析** | 自动识别文件格式和编码，PDF 表格也能解析 |
| 📝 **数据检修** | 自动检查缺失的音标、释义、词性，一键补全 |
| 📖 **词典补全** | 内置 77 万词条的英汉词典（ECDICT），查词典补全单词信息 |
| 🏷️ **语义分类** | 自动按意思把单词分成 10 大类 41 小类（食物、科技、情感……） |
| 🔎 **搜索浏览** | 按单词、释义、分类、难度搜索浏览，5 万单词也能流畅运行 |
| 📤 **导出** | 按全部/分类/难度导出 JSON 或 CSV 文件 |

---

## 📚 词典说明

应用内置两级词典，**克隆项目开箱即用**：

| 词典 | 规模 | 是否随仓库分发 |
|------|------|---------------|
| 精简版词典 `resources/ecdict-lite.json` | 约 22 万词条（有音标/有考试标签/有词频的词），22MB | ✅ 已入库，克隆即可用 |
| 完整大词典 `resources/ecdict-dict.json` | 约 77 万词条，67MB | ❌ 太大不入库 |

- 程序查找顺序：完整版 → 精简版 → 备用小词典（没有完整版时自动用精简版）
- 想用完整版：把 `resources/ecdict.csv`（需自行下载）转换生成 `node scripts/ecdict-to-dict.js`
- 精简版可随时从完整版重新生成：`node scripts/make-lite-dict.mjs`

---

## 💻 怎么运行

### 第一次使用（安装依赖）

```bash
npm install
```

> 如果下载速度慢，可以改用国内镜像：
> ```bash
> npm install --registry=https://registry.npmmirror.com
> ```

### 开发模式（边改代码边看效果）

```bash
npm run dev
```

### 打包成安装程序

```bash
npm run package:win    # Windows 安装包 (.exe)
npm run package:mac    # Mac 安装包 (.dmg)
```

---

## 🗂️ 项目结构（大白话版）

```
单词分类app/
├── src/
│   ├── main/               # 后台"引擎室"：读写文件、操作数据库、处理数据
│   │   ├── index.ts        # 入口：创建窗口、注册通信通道
│   │   ├── ipc/            # 界面和后端的通信桥梁
│   │   ├── parser/         # 文件解析（CSV/Excel/TXT/JSON/PDF）
│   │   ├── database/       # 数据库操作（sql.js，纯 JS 的 SQLite）
│   │   ├── validation/     # 数据校验和自动补全
│   │   ├── classification/ # 语义分类引擎
│   │
│   ├── preload/            # 安全桥梁（界面唯一能碰后台的通道）
│   │
│   └── renderer/           # 界面"仪表盘"（React 写的）
│       ├── components/     # 可复用组件（表格、按钮、拖拽区域……）
│       ├── views/          # 6 个页面（导入/检修/列表/分类/搜索/设置）
│       └── stores/         # 界面状态管理
│
├── resources/              # 词典数据文件
│   ├── ecdict-dict.json    # 77 万词条英汉词典（ECDICT 开源项目）
│   └── dictionary.json     # 834 词条备用小词典
│
├── scripts/                # 工具脚本（词典 CSV 转 JSON 等）
├── tests/                  # 单元测试（46 个用例）
└── out/                    # 构建产物（自动生成，不用管）
```

---

## 🧪 测试

```bash
npm run test          # 运行全部测试
npm run test:watch    # 监视模式（改代码自动重跑）
```

目前 7 个测试文件、46 个用例，覆盖解析器、校验、分类、数据库等核心模块。

---

## 📖 词典说明

词典数据来自开源项目 [ECDICT](https://github.com/skywind3000/ECDICT)（77 万词条英汉词典），用于"单词检修"页面的词典补全功能。

- 完整数据文件：`resources/ecdict-dict.json`（由 `ecdict.csv` 转换而来）
- 更新词典：下载最新的 `ecdict.csv` 放入 `resources/` 目录，然后运行：
  ```bash
  node scripts/ecdict-to-dict.js
  npm run postbuild
  ```

---

## 🛠️ 技术栈

| 层级 | 技术 | 为什么选它 |
|------|------|-----------|
| 桌面框架 | Electron | 用网页技术做桌面应用，一套代码同时支持 Windows 和 Mac |
| 界面 | React 18 + TypeScript | 组件化界面，类型检查减少错误 |
| 样式 | Tailwind CSS + shadcn/ui | 原子化 CSS，界面统一好看 |
| 数据库 | sql.js | 纯 JavaScript 的 SQLite，无需编译，跨平台零问题 |
| 文件解析 | xlsx + papaparse + pdf-parse | 处理 Excel、CSV、PDF 文件 |
| 打包 | electron-builder | 打包成 .exe / .dmg 安装程序 |

---

## 🔒 安全与隐私

- **所有数据只在本机**，不联网、不上传
- **界面与后台隔离**（contextIsolation + sandbox），安全基线合规
- **自动补全需确认**，程序不会偷偷改你的数据

---

## 🎯 开发路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 项目基础（Electron + React + 数据库） | ✅ 完成 |
| Phase 2 | 文件导入与解析（5 种格式） | ✅ 完成 |
| Phase 3 | 单词管理（浏览/搜索/编辑） | ✅ 完成 |
| Phase 4 | 数据校验与自动补全 | ✅ 完成 |
| Phase 5 | 语义分类引擎 | ✅ 完成 |
| Phase 6 | 导出与打包 | ✅ 完成 |

---

## 📄 许可证

词典数据（ECDICT）遵循其[开源协议](https://github.com/skywind3000/ECDICT/blob/master/LICENSE)。
