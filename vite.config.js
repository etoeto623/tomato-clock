import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue()
  ],
  root: resolve(__dirname, 'src'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  base: './', // 重要：使用相对路径作为基础路径
  build: {
    outDir: resolve(__dirname, 'dist'),
    assetsDir: 'assets',
    emptyOutDir: true,
    // 确保入口文件正确
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      },
      output: {
        // 确保生成相对路径而不是绝对路径
        preserveModules: false,
        // 资源文件命名
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        // 关键配置：确保所有模块路径使用相对路径
        paths: {
          // 这个空对象配置会强制使用相对路径
        }
      }
    },
    // 确保所有依赖都正确打包
    commonjsOptions: {
      include: /node_modules/
    },
    // 确保Vue应用在Electron环境中正常运行
    esbuild: {
      target: 'es2020'
    }
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true
  }
})