import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // KaitaiStream optionally requires these Node modules — stub them for the browser
      'zlib': path.resolve(__dirname, 'src/stubs/zlib.ts'),
      'iconv-lite': path.resolve(__dirname, 'src/stubs/iconv-lite.ts'),
    },
  },
  build: {
    chunkSizeWarningLimit: 4000, // kaitai-struct-compiler is large (~3.6MB)
  },
  test: {
    environment: 'node',
  },
})
