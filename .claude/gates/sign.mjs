#!/usr/bin/env node
/**
 * 质量门通行证的签发与校验工具。
 *
 * 用法：
 *   node .claude/gates/sign.mjs unit-test "68 tests passed"   # 签发单元测试通行证
 *   node .claude/gates/sign.mjs quality "无阻塞性问题"        # 签发质量检查通行证
 *   node .claude/gates/sign.mjs --check                       # 校验两张通行证是否都有效
 *
 * 通行证有效期 60 分钟；stateHash 绑定"签发那一刻的代码状态"——
 * 签发后代码一旦改动（git status 变化或 HEAD 变化），通行证立即失效。
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const GATES_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(GATES_DIR, '..', '..')
// 有效期 60 分钟：质量检查代理跑完整注释检查+安全审计需要几分钟，
// 原来的 15 分钟太短会让 unit-test 通行证在检查期间过期
const MAX_AGE_MS = 60 * 60 * 1000
const GATES = ['unit-test', 'quality']

function passPath(gate) {
  return join(GATES_DIR, `${gate}.pass`)
}

function git(cmd) {
  // 静音 Windows 下 CRLF 换行警告（走 stderr，不污染哈希，但会干扰输出）
  return execSync(`git ${cmd}`, { encoding: 'utf-8', cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
}

/**
 * 当前代码状态指纹：对全部"会被提交的文件"（已跟踪 + 未跟踪且未被忽略）的内容逐一哈希。
 * 完全不依赖 git 的暂存状态——git add 只是暂存，文件内容不变，指纹就不变；
 * 任何文件内容一变，指纹立刻变，通行证失效。
 * ⚠️ 此函数与 .claude/hooks/pre-commit-check.mjs 里的实现必须保持一致。
 */
function stateHash() {
  const files = git('ls-files --cached --others --exclude-standard').trim().split('\n').filter(Boolean)
  const h = createHash('sha256')
  for (const f of files) {
    h.update(f + '\n')
    try {
      const contentHash = createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex')
      h.update(contentHash + '\n')
    } catch {
      h.update('<missing>\n')  // 已删除的文件：记占位符（签名与校验两侧行为一致）
    }
  }
  return h.digest('hex').slice(0, 16)
}

function sign(gate, summary) {
  mkdirSync(GATES_DIR, { recursive: true })
  const pass = {
    gate,
    summary: summary || '',
    issuedAt: Date.now(),
    stateHash: stateHash()
  }
  writeFileSync(passPath(gate), JSON.stringify(pass, null, 2))
  console.log(`✅ 已签发 ${gate} 通行证（代码状态 ${pass.stateHash}，60 分钟内有效）`)
}

/** 校验单张通行证，返回 { ok, reason } */
function verifyGate(gate) {
  const p = passPath(gate)
  if (!existsSync(p)) return { ok: false, reason: `缺少 ${gate} 通行证（应由对应检查代理签发）` }
  let pass
  try { pass = JSON.parse(readFileSync(p, 'utf-8')) } catch {
    return { ok: false, reason: `${gate} 通行证损坏` }
  }
  if (!pass.issuedAt || Date.now() - pass.issuedAt > MAX_AGE_MS) {
    return { ok: false, reason: `${gate} 通行证已过期（超过 60 分钟），请重新检查` }
  }
  if (pass.stateHash !== stateHash()) {
    return { ok: false, reason: `${gate} 通行证失效：签发后代码又改动了，请重新检查` }
  }
  return { ok: true, reason: '' }
}

function checkAll() {
  const results = GATES.map(g => ({ g, ...verifyGate(g) }))
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.g}: ${r.ok ? '有效' : r.reason}`)
  }
  process.exit(results.every(r => r.ok) ? 0 : 1)
}

// 入口
const [mode, summary] = process.argv.slice(2)
if (mode === '--check') {
  checkAll()
} else if (GATES.includes(mode) && summary) {
  sign(mode, summary)
} else {
  console.error('用法: node .claude/gates/sign.mjs <unit-test|quality> "<摘要>" | --check')
  process.exit(1)
}
