import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      exclude: [
        'src/components/ui/**',
        'src/lib/types.ts',
        'src/__tests__/**',
        'node_modules/**',
        'vitest.config.ts',
        'next.config.ts',
        'src/middleware.ts',
        'src/app/layout.tsx',
        'src/app/page.tsx',
        'src/app/globals.css',
        'src/app/sign-in/**',
        'src/app/sign-up/**',
        'src/components/ThemeProvider.tsx',
        'src/components/modals/**',
        'src/components/calendar/**',
        'src/components/licitaciones/PriceSearchSection.tsx',
        'src/components/dashboard/DashboardShell.tsx',
        'src/components/dashboard/FilterBar.tsx',
        'src/components/dashboard/SavedFiltersSection.tsx',
        'src/components/licitaciones/LicitacionListItem.tsx',
        'src/components/licitaciones/LicitacionTable.tsx',
      ],
    },
  },
});
