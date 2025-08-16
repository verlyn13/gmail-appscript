import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.*',
        'scripts/',
        'deployment/',
        '.github/',
        'coverage/',
        '**/index.ts',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.test.ts'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    include: [
      'tests/**/*.{test,spec}.{js,ts}',
      'shared/**/*.{test,spec}.{js,ts}',
      'accounts/**/scripts/**/*.{test,spec}.{js,ts}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache'
    ],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: true,
    threads: true,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@libraries': path.resolve(__dirname, './shared/libraries'),
      '@utilities': path.resolve(__dirname, './shared/utilities'),
      '@templates': path.resolve(__dirname, './shared/templates'),
      '@config': path.resolve(__dirname, './config'),
      '@accounts': path.resolve(__dirname, './accounts')
    }
  }
});