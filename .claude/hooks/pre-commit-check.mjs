#!/usr/bin/env node
/**
 * git commit 拦截 Hook（PreToolUse / Bash）。
 *
 * 规则：任何包含 "git commit" 的命令，必须持有两张有效通行证：
 *   1. unit-test 通行证（单元检测 agent 在正常环境真实跑完测试后签发）
 *   2. quality 通行证（质量检查 agent 完成注释检查+安全审计后签发）
 * 通行证有效 = 60 分钟内签发 + 代码内容指纹一致（代码一改立即失效）。
 * 测试证据由通行证承载——Hook 本身不在受限执行环境里跑测试
 * （Hook 进程沙箱无法创建 vitest 工作线程，会假性全败）。
 * 任一通行证无效 → exit 2 拦截提交，stderr 给出中文原因；
 * 非 commit 命令 → 立即放行（不拖慢任何其他操作）。
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATES_DIR = join(ROOT, '.claude', 'gates')
const MAX_AGE_MS = 60 * 60 * 1000

function deny(systemMessage) {
  process.stderr.write(JSON.stringify({
    hookSpecificOutput: { permissionDecision: 'deny' },
    systemMessage: `⛔ git commit 被质量门拦截：${systemMessage}`
  }))
  process.exit(2)
}

function git(cmd) {
  // 静音 Windows 下 CRLF 换行警告（走 stderr，不污染哈希，但会干扰输出）
  return execSync(`git ${cmd}`, { encoding: 'utf-8', cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
}

/**
 * 与 .claude/gates/sign.mjs 完全一致的代码状态指纹。
 * 直接对全部"会被提交的文件"内容做哈希——与 git 暂存状态完全无关，
 * git add 不会让通行证失效；任何文件内容一改，指纹立刻变。
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
      h.update('<missing>\n')
    }
  }
  return h.digest('hex').slice(0, 16)
}

function verifyGate(gate) {
  const p = join(GATES_DIR, `${gate}.pass`)
  if (!existsSync(p)) return `缺少「${gate}」通行证（请先调用对应检查代理：git-archiver 或单独运行）`
  let pass
  try { pass = JSON.parse(readFileSync(p, 'utf-8')) } catch { return `「${gate}」通行证损坏` }
  if (!pass.issuedAt || Date.now() - pass.issuedAt > MAX_AGE_MS) {
    return `「${gate}」通行证已过期（超 60 分钟），需重新检查`
  }
  if (pass.stateHash !== stateHash()) {
    return `「${gate}」通行证失效：签发后代码又被改动，需重新检查`
  }
  return null
}

// ============ 主流程 ============
let input
try {
  input = JSON.parse(await new Promise((resolve) => {
    let d = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', c => { d += c })
    process.stdin.on('end', () => resolve(d || '{}'))
  }))
} catch { input = {} }

const cmd = input.tool_input?.command ?? ''
// 提交命令识别：git + 任意数量的选项（-c key=value / --no-pager / -C 路径…）+ commit 子命令。
// 选项值用负向断言排除 "commit" 本身，避免 `git --no-pager commit` 把 commit 吃成选项值。
const COMMIT_RE = /(^|[\s;&|])git(?:\s+--?[A-Za-z][A-Za-z0-9-]*(?:\s+(?!commit\b)[^\s]+)?)*\s+commit(?:\s|$)/
if (!COMMIT_RE.test(cmd)) process.exit(0) // 不是提交命令：放行

// 两张通行证（测试证据由 unit-test 通行证承载：签发前已在正常环境真实跑完测试）
const problems = ['unit-test', 'quality'].map(verifyGate).filter(Boolean)
if (problems.length > 0) deny(problems.join('；'))

console.log('✅ 质量门通过：双通行证有效（单元测试已在签发时真实通过）')
process.exit(0)
