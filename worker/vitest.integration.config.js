import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineWorkersConfig({
  test: {
    root: __dirname,
    include: ['test/integration/**/*.test.js'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
