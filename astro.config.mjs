import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://prizma.to',
  build: {
    // Two external stylesheets (~34 KB) were blocking the first paint, which costs
    // a round trip each on mobile. Inlined they cost a few KB of HTML instead.
    inlineStylesheets: 'always',
  },
});
