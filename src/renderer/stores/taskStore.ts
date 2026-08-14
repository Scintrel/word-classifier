/**
 * 批量任务的全局状态（切页不丢失）。
 * 任务循环由 taskRunner.ts 驱动，页面组件只订阅显示。
 */
import { create } from 'zustand'

export type TaskType = 'dictFix' | 'normalize' | 'refill'

export const TASK_LABELS: Record<TaskType, string> = {
  dictFix: '词典补全',
  normalize: '音标规范化',
  refill: '等级词频回填'
}

export interface TaskState {
  status: 'idle' | 'running' | 'done' | 'error'
  current: number
  total: number
  /** 完成/失败摘要 */
  message: string
  /** 完成明细（结果横幅展示用） */
  details: string[]
}

const idle = (): TaskState => ({ status: 'idle', current: 0, total: 0, message: '', details: [] })

interface TaskStore {
  tasks: Record<TaskType, TaskState>
  update: (type: TaskType, patch: Partial<TaskState>) => void
  /** 清掉一个任务的完成状态（用户点关闭横幅后） */
  dismiss: (type: TaskType) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: {
    dictFix: idle(),
    normalize: idle(),
    refill: idle()
  },
  update: (type, patch) => set(s => ({
    tasks: { ...s.tasks, [type]: { ...s.tasks[type], ...patch } }
  })),
  dismiss: (type) => set(s => ({
    tasks: { ...s.tasks, [type]: { ...idle() } }
  }))
}))

/** 是否有任务正在运行（顶部栏指示器用） */
export function runningTask(tasks: Record<TaskType, TaskState>): { type: TaskType; state: TaskState } | null {
  for (const type of Object.keys(tasks) as TaskType[]) {
    const s = tasks[type]
    if (s.status === 'running') return { type, state: s }
  }
  return null
}
