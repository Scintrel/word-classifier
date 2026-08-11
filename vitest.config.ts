import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Mock electron module for tests running in plain Node.js
    resolve: {
      alias: {
        electron: resolve(__dirname, 'tests/__mocks__/electron.ts')
      }
    }
  }
})
