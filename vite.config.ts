import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * 构建目标：一个自包含的 dist/index.html（JS/CSS 全部内联）。
 * 使用者双击即可打开，不需要服务器。
 */
export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  base: './',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
});
