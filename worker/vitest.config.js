import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/generated/**'],
    },
  },
});
