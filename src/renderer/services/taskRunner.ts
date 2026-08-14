/**
 * 批量任务执行器（模块级单例）。
 *
 * 任务循环在这里运行而不是在页面组件里——切页时组件会卸载，
 * 但模块不会被销毁，所以任务能跨页面继续跑，进度通过 taskStore 全局可见。
 */
import { useTaskStore, TASK_LABELS, type TaskType } from '../stores/taskStore'

/** 操作记录上报（失败不影响任务本身） */
function logAction(action: string, detail?: string) {
  window.api.devLogUserAction({ action, detail }).catch(() => {})
}

/** 每类任务一个运行标志，防止重复启动 */
const runningFlags: Record<TaskType, boolean> = {
  dictFix: false,
  normalize: false,
  refill: false
}

/** 任务是否正在运行（按钮禁用态） */
export function isTaskRunning(type: TaskType): boolean {
  return runningFlags[type]
}

/** 批量循环的防卡死参数 */
const BATCH_SIZE = 300

/** 通用的分批循环：count 拿总数，batch 跑一批，完成后 done=true */
async function runBatchLoop(
  type: TaskType,
  count: () => Promise<number>,
  batch: (size: number) => Promise<{ fixed: number; details?: string[]; done: boolean }>,
  onDone: (result: { fixed: number; details: string[] }) => void
): Promise<void> {
  if (runningFlags[type]) return
  runningFlags[type] = true
  const store = useTaskStore.getState()
  store.update(type, { status: 'running', current: 0, total: 0, message: '', details: [] })
  logAction('开始任务', TASK_LABELS[type])
  try {
    const total = await count()
    if (total === 0) {
      onDone({ fixed: 0, details: [] })
      return
    }
    store.update(type, { total })
    let totalFixed = 0
    const allDetails: string[] = []
    let attempts = 0
    // 防卡死：最多循环"总数/每批"批 + 2 批余量
    const maxAttempts = Math.ceil(total / BATCH_SIZE) + 2
    while (attempts < maxAttempts) {
      const data = await batch(BATCH_SIZE)
      // 词典未加载等错误（fixed = -1）
      if (data.fixed === -1) {
        store.update(type, {
          status: 'error',
          message: (data.details ?? [])[0] ?? '任务失败',
          details: data.details ?? []
        })
        logAction('任务失败', TASK_LABELS[type])
        return
      }
      totalFixed += data.fixed
      allDetails.push(...(data.details ?? []))
      store.update(type, { current: totalFixed })
      attempts++
      if (data.done) break
      // 本批没有进展，避免无限循环
      if (data.fixed === 0 && attempts > 1) break
    }
    onDone({ fixed: totalFixed, details: allDetails })
    logAction('任务完成', `${TASK_LABELS[type]} ${totalFixed} 个`)
  } catch (err) {
    console.error(`Task ${type} failed:`, err)
    store.update(type, { status: 'error', message: String(err) })
    logAction('任务失败', TASK_LABELS[type])
  } finally {
    runningFlags[type] = false
  }
}

/** 词典补全 */
export function startDictFix(): Promise<void> {
  return runBatchLoop(
    'dictFix',
    () => window.api.autoFixCount(),
    (size) => window.api.autoFixBatch(size),
    ({ fixed, details }) => useTaskStore.getState().update('dictFix', {
      status: 'done', current: fixed, message: `${fixed} 个单词`, details
    })
  )
}

/** 音标规范化 */
export function startNormalize(): Promise<void> {
  return runBatchLoop(
    'normalize',
    () => window.api.normalizePhoneticsCount(),
    (size) => window.api.normalizePhoneticsBatch(size),
    ({ fixed, details }) => useTaskStore.getState().update('normalize', {
      status: 'done', current: fixed, message: `${fixed} 个单词`, details
    })
  )
}

/** 等级词频回填 */
export function startRefill(): Promise<void> {
  return runBatchLoop(
    'refill',
    () => window.api.refillLevelsCount(),
    (size) => window.api.refillLevelsBatch(size),
    ({ fixed, details }) => useTaskStore.getState().update('refill', {
      status: 'done', current: fixed, message: `${fixed} 个单词`, details
    })
  )
}
