import { defineConfig } from 'vite';

/** One-file build used for the shareable artifact: no code splitting at all. */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist-artifact',
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
