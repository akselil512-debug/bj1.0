import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE_FILE=1 builds one self-contained index.html (used for private test links).
// The normal build is a regular static site for GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), ...(process.env.SINGLE_FILE ? [viteSingleFile()] : [])],
  test: { include: ['tests/**/*.test.ts'] },
});
