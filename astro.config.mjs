import { defineConfig } from 'astro/config';
import { generateAgentMarkdown } from './scripts/build-agent-markdown.mjs';

// Vercel’s Astro preset may call `astro build` directly, so the markdown
// alternates are generated here rather than only from package.json.
generateAgentMarkdown();

export default defineConfig({
  output: 'static',
  site: 'https://prizma.to',
  build: {
    // Two external stylesheets (~34 KB) were blocking the first paint, which costs
    // a round trip each on mobile. Inlined they cost a few KB of HTML instead.
    inlineStylesheets: 'always',
  },
});
