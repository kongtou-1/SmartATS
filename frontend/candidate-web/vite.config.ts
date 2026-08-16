import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When the backend API is served from a different origin, set VITE_API_BASE
// (e.g. http://localhost:8111/api/v1). During dev the Vite proxy below forwards
// /api to the backend (http://localhost:8111) so you can keep VITE_API_BASE unset.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8111',
        changeOrigin: true,
      },
    },
  },
});
