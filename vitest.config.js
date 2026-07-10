import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['electron/main/__tests__/**/*.test.js', '__tests__/**/*.test.js', 'tests/**/*.test.ts'],
    globals: true,
  },
})
