import path from 'path';
import { defineConfig } from 'vite'; // Removi o loadEnv daqui
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      base: './', 
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
