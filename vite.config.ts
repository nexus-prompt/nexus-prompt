import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        popup: resolve(process.cwd(), 'popup.html'),
        background: resolve(process.cwd(), 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
  },
  publicDir: 'public',
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,ts,svelte}'],
      exclude: [
        'src/**/*.{test,spec}.{js,ts}',
        'src/test/**',
        'e2e/**',
        'src/chrome-mock.ts',
        'src/app.d.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 70,
          lines: 30,
          statements: 30
        }
      }
    },
  },
}); 
