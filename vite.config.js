import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { astryxStylex } from '@astryxdesign/build/vite'

// Giống hệt cấu hình build của Ahri App (Astryx StyleX + React Compiler)
export default defineConfig({
  plugins: [
    ...astryxStylex(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: { host: '127.0.0.1', port: 5178 },
})
