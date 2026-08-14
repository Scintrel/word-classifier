import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  // Mock electron module for tests running in plain Node.js
  // （必须放在顶层 resolve 下，放在 test 里不生效）
  resolve: {
    alias: {
      electron: resolve(__dirname, 'tests/__mocks__/electron.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
