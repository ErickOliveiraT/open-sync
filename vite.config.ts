import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // Main process entry
        entry: 'electron/main.ts',
      },
      preload: {
        // Preload script entry
        input: 'electron/preload.ts',
      },
      // Renderer process can use Node.js APIs
      renderer: {},
    }),
  ],
})
