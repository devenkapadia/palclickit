import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

const api = process.env.API_URL ?? 'http://localhost:4000';

/** Fills the <title> / meta description in index.html from shared/content.json (so all text lives in one file). */
const contentMeta = (): Plugin => {
  const file = path.resolve(import.meta.dirname, 'shared/content.json');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return {
    name: 'content-meta',
    transformIndexHtml(html) {
      const { meta, brand } = JSON.parse(fs.readFileSync(file, 'utf8'));
      const fill = (s: string) => s.replaceAll('{brand}', brand.name);
      return html.replace('%META_TITLE%', esc(fill(meta.title))).replace('%META_DESCRIPTION%', esc(fill(meta.description)));
    },
    configureServer(server) {
      server.watcher.add(file);
      server.watcher.on('change', (f) => { if (path.resolve(f) === file) server.ws.send({ type: 'full-reload' }); });
    },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), contentMeta()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src'), '@shared': path.resolve(import.meta.dirname, 'shared') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: api, changeOrigin: false },
      '/uploads': { target: api, changeOrigin: false },
    },
  },
  // The admin bundle (charts etc.) is lazy-loaded and only fetched on /admin.
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 700 },
});
