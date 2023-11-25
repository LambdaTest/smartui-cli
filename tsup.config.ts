import { defineConfig } from 'tsup';

export default defineConfig((options) => [
  {
    entry: ['./src/index.ts'],
    splitting: false,
    treeshake: true,
    sourcemap: false,
    clean: true,
    format: ['cjs'],
    publicDir: './src/dom'
  }
]);
