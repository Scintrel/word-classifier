/**
 * 开发者模式开关的全局状态（设置页开关 ↔ 侧边栏入口共用）。
 */
import { create } from 'zustand'

interface DevState {
  enabled: boolean
  setEnabled: (v: boolean) => void
}

export const useDevStore = create<DevState>((set) => ({
  enabled: false,
  setEnabled: (v) => set({ enabled: v })
}))
