import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // ESSENCIAL: O ponto antes da barra garante que o App ache os próprios arquivos no Itch.io
  base: './', 
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Isso ajuda a evitar erros de caminhos em arquivos muito grandes
    assetsDir: 'assets',
    emptyOutDir: true,
  }
});
