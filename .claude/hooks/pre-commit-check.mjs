#!/usr/bin/env node
/**
 * git commit 拦截 Hook（PreToolUse / Bash）。
 *
 * 规则：任何包含 "git commit" 的命令，必须先通过质量门：
 *   1. unit-test 通行证（单元检测 agent 签发）——存在、未过期、代码状态一致
 *   2. quality 通行证（质量检查 agent 签发）——同上
 *   3. 实跑 npm run test —— 最终硬闸
 * 任一不满足 → exit 2 拦截提交，stderr 给出中文原因；
 * 非 commit 命令 → 立即放行（不拖慢任何其他操作）。
 */
import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATES_DIR = join(ROOT, '.claude', 'gates')
const MAX_AGE_MS = 15 * 60 * 1000

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
 * 暂存动作（git add）不会改变指纹——否则签发通行证后一 add 就失效，永远无法提交。
 */
function stateHash() {
  const head = git('rev-parse HEAD').trim()
  const unstaged = git('diff')
  const staged = git('diff --cached')
  const untracked = git('ls-files --others --exclude-standard')
  const material = [head, unstaged, staged, untracked].join('\n---\n')
  return createHash('sha256').update(material).digest('hex').slice(0, 16)
}

function verifyGate(gate) {
  const p = join(GATES_DIR, `${gate}.pass`)
  if (!existsSync(p)) return `缺少「${gate}」通行证（请先调用对应检查代理：git-archiver 或单独运行）`
  let pass
  try { pass = JSON.parse(readFileSync(p, 'utf-8')) } catch { return `「${gate}」通行证损坏` }
  if (!pass.issuedAt || Date.now() - pass.issuedAt > MAX_AGE_MS) {
    return `「${gate}」通行证已过期（超 15 分钟），需重新检查`
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
if (!/\bgit\s+commit\b/.test(cmd)) process.exit(0) // 不是提交命令：放行

// 1. 两张通行证
const problems = ['unit-test', 'quality'].map(verifyGate).filter(Boolean)
if (problems.length > 0) deny(problems.join('；'))

// 2. 实跑单元测试（最终硬闸）
const test = spawnSync('npm', ['run', 'test'], {
  cwd: ROOT, encoding: 'utf-8', timeout: 110_000, shell: true
})
if (test.status !== 0) {
  const tail = (test.stdout || '').split('\n').filter(l => /failed|passed|✗|×/i.test(l)).slice(-5).join(' ')
  deny(`npm run test 未通过（exit ${test.status}）${tail ? '：' + tail : ''}`)
}

console.log('✅ 质量门通过：双通行证有效 + 单元测试全绿')
process.exit(0)
