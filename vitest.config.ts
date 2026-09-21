import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Тесты запускаются отдельным конфигом: production-сборка (vite.config.ts)
// остаётся без тестовой обвязки.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
    css: false,
  },
})
