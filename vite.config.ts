import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // chemins relatifs : nécessaire pour charger dist/ via file:// dans Electron
  server: { port: 5173, strictPort: true },
});
