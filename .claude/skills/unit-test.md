---
name: unit-test
description: 对项目代码编写和运行单元测试，生成测试报告
model: haiku
---

# 单元测试技能

## 测试框架

本项目使用 **Vitest** v4 作为单元测试框架，配合 **sql.js** 做数据库层的内存测试。

- **测试目录**: `tests/`
- **配置文件**: `vitest.config.ts`
- **Mock 目录**: `tests/__mocks__/`（electron 等浏览器 API 的 mock）

## 测试文件结构

```
tests/
├── __mocks__/electron.ts     # Electron API mock（测试在 Node.js 中运行，无 Electron）
├── parser/
│   ├── csv.parser.test.ts    # CSV 解析器测试
│   ├── txt.parser.test.ts    # TXT 解析器测试
│   └── json.parser.test.ts   # JSON 解析器测试
├── validation/
│   ├── validator.test.ts     # 数据校验引擎测试
│   └── autoComplete.test.ts  # 自动补全测试
├── classification/
│   └── classifier.test.ts    # 语义分类引擎测试
└── database/
    └── migrations.test.ts    # 数据库迁移测试
```

## 运行测试

```bash
npm run test          # 运行全部测试，输出结果后退出
npm run test:watch    # 监视模式，代码改动后自动重跑
```

## 编写测试的步骤

### 1. 创建测试文件

测试文件放在 `tests/<模块名>/<功能名>.test.ts`，文件名必须以 `.test.ts` 结尾。

### 2. 测试模板

**不依赖数据库的纯逻辑测试：**
```ts
// tests/example/simple.test.ts
import { describe, it, expect } from 'vitest'
import { someFunction } from '../../src/main/path/to/module'

describe('模块名称', () => {
  it('应该做某件事', () => {
    const result = someFunction('input')
    expect(result).toBe('expected')
  })

  it('边界情况：空输入', () => {
    const result = someFunction('')
    expect(result).toBeNull()
  })
})
```

**依赖数据库的测试：**
```ts
// tests/example/db.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database as SqlJsDatabase } from 'sql.js'

let db: SqlJsDatabase

beforeAll(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  // 创建需要的表
  db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')
})

afterAll(() => { db.close() })

it('应该插入并查询数据', () => {
  db.run("INSERT INTO test VALUES (1, 'hello')")
  const r = db.exec('SELECT * FROM test')
  expect(r[0].values[0]).toEqual([1, 'hello'])
})
```

**依赖 Electron 模块的测试（需要 mock）：**
```ts
import { describe, it, expect, vi } from 'vitest'

// Mock electron 模块 —— 配置在 vitest.config.ts 中
// 测试可以直接 import 使用 electron 的代码
import { someMainProcessFunc } from '../../src/main/ipc/handlers'
```

### 3. 常用断言方法

```ts
expect(value).toBe(expected)          // 严格相等 ===
expect(value).toEqual(expected)       // 深度相等
expect(value).toBeNull()              // 是 null
expect(value).toBeGreaterThan(0)      // 大于
expect(value).toContain('substring')  // 数组/字符串包含
expect(array).toHaveLength(3)         // 数组长度
expect(fn).toThrow('error message')   // 抛出异常
```

## Mock 和 Electron 依赖处理

测试在纯 Node.js 中运行（没有 Electron）。`vitest.config.ts` 中配置了 `electron` 模块的 alias 指向 `tests/__mocks__/electron.ts`。

`tests/__mocks__/electron.ts` 提供了测试所需的最小 Electron API：
- `app.getPath()` → 临时测试目录
- `BrowserWindow` → 空类
- `ipcMain.handle()` → 空函数
- `dialog.showOpenDialog()` → 返回测试文件路径

## 测试报告

每次运行测试后，根据输出汇总：

1. **通过率**: `X passed / Y total`
2. **失败详情**: 哪些测试文件失败，每个失败测试的错误原因
3. **覆盖率评估**: 哪些模块有测试覆盖，哪些模块缺少测试
4. **发现的生产代码 Bug**: 测试过程中发现的实际问题

## 当前测试覆盖状态

| 模块 | 测试数 | 文件 |
|------|--------|------|
| CSV 解析器 | 7 | csv.parser.test.ts |
| TXT 解析器 | 6 | txt.parser.test.ts |
| JSON 解析器 | 5 | json.parser.test.ts |
| 自动补全 | 12 | autoComplete.test.ts |
| 数据校验 | 7 | validator.test.ts |
| 语义分类 | 4 | classifier.test.ts |
| 数据库迁移 | 7 | migrations.test.ts |
| **总计** | **48** | **7 文件** |

**未覆盖的模块**（建议补充测试）：
- Excel 解析器（需要 `.xlsx` 测试文件）
- PDF 解析器（需要 `.pdf` 测试文件）
- IPC handlers（需要 Electron 完整的 IPC mock 环境）
- React 前端组件（需要 jsdom 环境）
