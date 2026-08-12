import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Served from https://navaidya.github.io/stock/, so every internal link must go
// through withBase() in src/lib/url.ts. Root-relative hrefs work locally and
// 404 in production.
export default defineConfig({
  site: 'https://navaidya.github.io',
  base: '/stock',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
